"""Verify an encoded video; standard library + ffprobe/ffmpeg only.

Does not establish visual quality, product provenance, or listening review.
"""
import argparse
import hashlib
import json
import math
from fractions import Fraction
from pathlib import Path
import subprocess
import sys


def command(args):
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(f"{args[0]} failed ({result.returncode}): {result.stderr[-6000:]}")
    return result


def luma_stats(path, sample_width=160):
    """Mean and population stdev of luma for decoded frame 0, scaled to sample_width."""
    proc = subprocess.run(
        ['ffmpeg', '-hide_banner', '-nostdin', '-v', 'error', '-threads', '2', '-i', str(path),
         '-map', '0:v:0', '-vf', f'scale={sample_width}:-2', '-frames:v', '1', '-pix_fmt', 'rgb24',
         '-f', 'rawvideo', '-'],
        capture_output=True)
    if proc.returncode:
        raise RuntimeError(f'frame 0 extract failed: {proc.stderr.decode(errors="replace")[-2000:]}')
    raw = proc.stdout
    stride = sample_width * 3
    if not raw or len(raw) % stride:
        raise RuntimeError('frame 0 extract was truncated')
    height = len(raw) // stride
    if height < 2:
        raise RuntimeError('frame 0 extract was empty')
    total = 0.0
    count = sample_width * height
    samples = []
    for offset in range(0, len(raw), 3):
        luma = 0.299 * raw[offset] + 0.587 * raw[offset + 1] + 0.114 * raw[offset + 2]
        samples.append(luma)
        total += luma
    mean = total / count
    variance = sum((value - mean) ** 2 for value in samples) / count
    return {'meanLuma': round(mean, 3), 'stdevLuma': round(math.sqrt(variance), 3),
            'sampleWidth': sample_width, 'sampleHeight': height}


def finite(value):
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (ValueError, TypeError):
        return None


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('file', type=Path)
    p.add_argument('--width', type=int, required=True)
    p.add_argument('--height', type=int, required=True)
    p.add_argument('--fps', required=True, help='Frame rate, e.g. 30 or 30000/1001')
    p.add_argument('--duration', type=float, required=True, help='Intended picture seconds; rounded to nearest frame')
    p.add_argument('--audio', choices=['required', 'optional', 'forbidden'], default='required')
    p.add_argument('--max-bytes', type=int)
    p.add_argument('--target-lufs', type=float)
    p.add_argument('--lufs-tolerance', type=float, default=0.6)
    p.add_argument('--max-true-peak', type=float)
    p.add_argument('--money-shot', choices=['on', 'off'], default='on',
        help='Reject a blank or near-black frame 0. Default on; off matches a disabled money shot.')
    p.add_argument('--min-luma', type=float, default=16, help='Frame 0 mean luma must be above this (0-255).')
    p.add_argument('--min-luma-stdev', type=float, default=8,
        help='Frame 0 luma standard deviation must be at least this, so a flat frame cannot pass as a hero or title.')
    p.add_argument('--report', type=Path)
    a = p.parse_args()
    fps = Fraction(a.fps)
    if fps <= 0 or a.width <= 0 or a.height <= 0 or not math.isfinite(a.duration) or a.duration <= 0:
        p.error('dimensions, FPS and duration must be positive and finite')
    if a.lufs_tolerance < 0 or (a.max_bytes is not None and a.max_bytes <= 0):
        p.error('invalid tolerance or byte budget')
    if any(v is not None and not math.isfinite(v) for v in [a.target_lufs, a.max_true_peak, a.lufs_tolerance, a.min_luma, a.min_luma_stdev]):
        p.error('loudness and money-shot parameters must be finite')
    if a.min_luma < 0 or a.min_luma > 255 or a.min_luma_stdev < 0:
        p.error('money-shot luma limits must be in range')
    if a.audio == 'forbidden' and (a.target_lufs is not None or a.max_true_peak is not None):
        p.error('loudness constraints conflict with forbidden audio')
    expected_frames = math.floor(a.duration * float(fps) + 0.5)
    if expected_frames < 1:
        p.error('duration must contain at least one frame')
    picture_seconds = expected_frames / float(fps)
    probe = json.loads(command(['ffprobe', '-v', 'error', '-threads', '2', '-count_frames',
        '-show_streams', '-show_format', '-of', 'json', str(a.file)]).stdout)
    videos = [s for s in probe['streams'] if s['codec_type'] == 'video']
    audio = [s for s in probe['streams'] if s['codec_type'] == 'audio']
    errors = []

    def check(condition, message):
        if not condition:
            errors.append(message)

    check(len(videos) == 1, f'expected one video stream, found {len(videos)}')
    if not videos:
        raise RuntimeError('No video stream')
    v = videos[0]
    actual_frames = int(v.get('nb_read_frames', 0))
    check((v['width'], v['height']) == (a.width, a.height), 'unexpected video dimensions')
    check(Fraction(v['r_frame_rate']) == fps, f"unexpected frame rate: {v['r_frame_rate']}")
    check(Fraction(v['avg_frame_rate']) == fps, f"unexpected average frame rate: {v['avg_frame_rate']}")
    check(actual_frames == expected_frames, f'expected {expected_frames} decoded frames, got {actual_frames}')
    video_duration = finite(v.get('duration'))
    if video_duration is not None:
        check(abs(video_duration - picture_seconds) <= 1 / float(fps) + 0.001, 'video duration mismatch')
    container_duration = finite(probe['format'].get('duration'))
    check(container_duration is not None and abs(container_duration - picture_seconds) <= max(0.1, 2 / float(fps)), 'container duration mismatch beyond frame/audio-padding tolerance')
    if a.audio == 'required':
        check(bool(audio), 'required audio stream absent')
    if a.audio == 'forbidden':
        check(not audio, 'unexpected audio stream in silent deliverable')
    for stream in audio:
        seconds = finite(stream.get('duration'))
        if seconds is not None:
            check(abs(seconds - picture_seconds) <= max(0.1, 2 / float(fps)), 'audio duration mismatch')
    size = a.file.stat().st_size
    if a.max_bytes is not None:
        check(size <= a.max_bytes, f'file exceeds budget: {size} > {a.max_bytes}')
    base = ['ffmpeg', '-hide_banner', '-nostdin', '-threads', '2', '-filter_threads', '2', '-filter_complex_threads', '2']
    command(base + ['-v', 'error', '-xerror', '-i', str(a.file), '-map', '0:v:0', '-map', '0:a?', '-threads', '2', '-f', 'null', '-'])
    loudness = None
    if audio:
        measured = command(base + ['-i', str(a.file), '-map', '0:a:0', '-af',
            'loudnorm=I=-14:TP=-1:LRA=11:print_format=json', '-threads', '2', '-f', 'null', '-']).stderr
        marker = measured.rfind('{')
        if marker < 0:
            raise RuntimeError('FFmpeg returned no loudness report')
        values = json.JSONDecoder().raw_decode(measured[marker:])[0]
        loudness = {'integratedLufs': finite(values['input_i']), 'truePeakDbtp': finite(values['input_tp']),
            'rangeLu': finite(values['input_lra']), 'scope': 'first encoded audio stream'}
    if a.target_lufs is not None:
        check(loudness is not None and loudness['integratedLufs'] is not None and
            abs(loudness['integratedLufs'] - a.target_lufs) <= a.lufs_tolerance, 'integrated loudness outside target/tolerance or no measurable audio')
    if a.max_true_peak is not None:
        check(loudness is not None and loudness['truePeakDbtp'] is not None and
            loudness['truePeakDbtp'] <= a.max_true_peak, 'true peak exceeds ceiling or no measurable audio')
    money = {'checked': False, 'reason': 'disabled'}
    if a.money_shot == 'on':
        money = luma_stats(a.file)
        money.update({'checked': True, 'nearBlackLimit': a.min_luma, 'minContrast': a.min_luma_stdev})
        check(money['meanLuma'] > a.min_luma,
              f"frame 0 is near-black (mean luma {money['meanLuma']} <= {a.min_luma}); open on a full-brightness hero")
        check(money['stdevLuma'] >= a.min_luma_stdev,
              f"frame 0 does not show a hero or title (flat frame, luma stdev {money['stdevLuma']} < {a.min_luma_stdev})")
    with a.file.open('rb') as source:
        digest = hashlib.file_digest(source, 'sha256').hexdigest()
    report = {'file': a.file.name, 'sha256': digest, 'bytes': size, 'videoCodec': v['codec_name'],
        'width': v['width'], 'height': v['height'], 'fps': v['r_frame_rate'], 'frames': actual_frames,
        'videoDuration': video_duration, 'containerDuration': container_duration,
        'expectedPictureDuration': picture_seconds, 'audioStreams': len(audio),
        'loudness': loudness, 'moneyShot': money, 'fullDecode': True, 'passed': not errors, 'errors': errors}
    if a.report:
        if a.report.resolve() == a.file.resolve():
            raise RuntimeError('Report path cannot overwrite input media')
        a.report.parent.mkdir(parents=True, exist_ok=True)
        a.report.write_text(json.dumps(report, indent=2, allow_nan=False) + '\n')
    print(json.dumps(report, indent=2, allow_nan=False))
    return 1 if errors else 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (RuntimeError, OSError, ValueError, KeyError, ZeroDivisionError) as exc:
        print(f'Verification failed: {exc}', file=sys.stderr)
        sys.exit(1)
