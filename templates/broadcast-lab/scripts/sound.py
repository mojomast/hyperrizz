"""Original, deterministic broadcast cues. No music/voice or external samples."""
from pathlib import Path
import array
import json
import math
import random
import wave

root = Path(__file__).resolve().parents[1]
settings = json.loads((root / 'settings.json').read_text())
rate = 48000
duration = sum(s['frames'] for s in settings['scenes']) / settings['fps']
track = [0.0] * round(rate * duration)
rng = random.Random(settings['seed'])

def tone(start, length, frequency, gain=0.10, decay=5):
    for i in range(round(length * rate)):
        t = i / rate
        env = min(1, t / 0.008) * min(1, (length - t) / 0.025) * math.exp(-decay * t)
        sample = (math.sin(2 * math.pi * frequency * t) + 0.18 * math.sin(4 * math.pi * frequency * t)) * env * gain
        index = round(start * rate) + i
        if 0 <= index < len(track):
            track[index] += sample

for i, frequency in enumerate([261.63, 329.63, 392, 523.25]):
    tone(0.25 + i * 0.14, 0.7, frequency)
for start in [4, 8, 12]:
    for i in range(round(0.18 * rate)):
        t = i / rate
        track[round(start * rate) + i] += (rng.random() * 2 - 1) * 0.06 * min(1, t / 0.004) * (1 - t / 0.18)
    tone(start + 0.22, 0.25, 659.25, 0.08)
for start in [5, 6.1]:
    tone(start, 0.3, 880, 0.07, 9)
for frequency in [590, 845, 1190]:
    tone(10.2, 0.7, frequency, 0.04, 5)
for i, frequency in enumerate([392, 523.25, 659.25, 783.99, 659.25, 523.25]):
    tone(12.3 + i * 0.23, 0.8, frequency, 0.08, 4)
tone(15.1, 0.55, 220, 0.07, 7)
peak = max(abs(v) for v in track)
gain = 0.55 / peak if peak else 1
samples = array.array('h', (round(v * gain * min(1, (len(track) - i) / (rate * 0.5)) * 32767) for i, v in enumerate(track)))
import sys
if sys.byteorder != 'little':
    samples.byteswap()
with wave.open(str(root / 'assets/broadcast.wav'), 'wb') as output:
    output.setnchannels(1)
    output.setsampwidth(2)
    output.setframerate(rate)
    output.writeframes(samples.tobytes())
