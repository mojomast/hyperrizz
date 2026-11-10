"""Small real-FFmpeg regression fixtures for the bundled media verifier."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'templates/starter/scripts/verify-media.py'


class MediaVerifierTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        base = '/tmp/opencode' if Path('/tmp/opencode').is_dir() else None
        cls.temp = tempfile.TemporaryDirectory(prefix='hyperframes-verifier-', dir=base)
        cls.root = Path(cls.temp.name)
        cls.audible = cls.root / 'audio.mp4'
        cls.silent = cls.root / 'silent.mp4'
        cls.black = cls.root / 'black.mp4'
        cls.flat = cls.root / 'flat.mp4'
        # Cream plate on ink: a finished title card, not a flat field.
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-threads', '2', '-filter_threads', '2',
            '-f', 'lavfi', '-i', 'color=c=0x141820:s=160x90:r=30:d=2',
            '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=2',
            '-filter_complex', '[0:v]drawbox=x=8:y=16:w=144:h=58:color=0xfff0cf:t=fill[v]',
            '-map', '[v]', '-map', '1:a',
            '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-threads', '2', '-c:a', 'aac', str(cls.audible)], check=True)
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-threads', '2', '-i', str(cls.audible),
            '-c:v', 'copy', '-an', str(cls.silent)], check=True)
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-threads', '2',
            '-f', 'lavfi', '-i', 'color=c=black:s=160x90:r=30:d=2',
            '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-threads', '2', '-an', str(cls.black)], check=True)
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-threads', '2',
            '-f', 'lavfi', '-i', 'color=c=0x808080:s=160x90:r=30:d=2',
            '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-threads', '2', '-an', str(cls.flat)], check=True)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def verify(self, file, *args):
        return subprocess.run([sys.executable, str(SCRIPT), str(file), '--width', '160',
            '--height', '90', '--fps', '30', '--duration', '2', *args], capture_output=True, text=True)

    def test_audio_measurement_and_targets(self):
        result = self.verify(self.audible)
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual(report['frames'], 60)
        self.assertGreater(report['moneyShot']['meanLuma'], 16)
        self.assertGreaterEqual(report['moneyShot']['stdevLuma'], 8)
        self.assertEqual(report['sha256'], hashlib.sha256(self.audible.read_bytes()).hexdigest())
        loudness = report['loudness']
        self.assertIsInstance(loudness['integratedLufs'], float)
        result = self.verify(self.audible, '--target-lufs', str(loudness['integratedLufs']),
            '--max-true-peak', str(loudness['truePeakDbtp'] + 0.1))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_missing_required_audio(self):
        self.assertNotEqual(self.verify(self.silent).returncode, 0)

    def test_forbidden_audio(self):
        self.assertNotEqual(self.verify(self.audible, '--audio', 'forbidden').returncode, 0)
        self.assertEqual(self.verify(self.silent, '--audio', 'forbidden').returncode, 0)

    def test_wrong_specs_and_size(self):
        for args in [('--width', '1920'), ('--fps', '60'), ('--duration', '3'), ('--max-bytes', '100')]:
            with self.subTest(args=args):
                result = self.verify(self.silent, '--audio', 'forbidden', *args)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(json.loads(result.stdout)['passed'])

    def test_loudness_failures(self):
        for args in [('--target-lufs', '0'), ('--max-true-peak', '-80')]:
            with self.subTest(args=args):
                self.assertNotEqual(self.verify(self.audible, *args).returncode, 0)
        self.assertNotEqual(self.verify(self.silent, '--audio', 'optional', '--target-lufs', '-14').returncode, 0)

    def test_corrupt_media(self):
        corrupt = self.root / 'corrupt.mp4'
        corrupt.write_bytes(self.audible.read_bytes()[:512])
        self.assertNotEqual(self.verify(corrupt).returncode, 0)

    def test_money_shot_rejects_blank_and_near_black_openings(self):
        black = self.verify(self.black, '--audio', 'forbidden')
        self.assertNotEqual(black.returncode, 0, black.stdout + black.stderr)
        self.assertTrue(any('near-black' in error for error in json.loads(black.stdout)['errors']))
        flat = self.verify(self.flat, '--audio', 'forbidden')
        self.assertNotEqual(flat.returncode, 0, flat.stdout + flat.stderr)
        self.assertTrue(any('hero or title' in error for error in json.loads(flat.stdout)['errors']))
        opted_out = self.verify(self.black, '--audio', 'forbidden', '--money-shot', 'off')
        self.assertEqual(opted_out.returncode, 0, opted_out.stdout + opted_out.stderr)
        self.assertFalse(json.loads(opted_out.stdout)['moneyShot']['checked'])

    def test_report_cannot_overwrite_media(self):
        before = self.audible.read_bytes()
        self.assertNotEqual(self.verify(self.audible, '--report', str(self.audible)).returncode, 0)
        self.assertEqual(self.audible.read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
