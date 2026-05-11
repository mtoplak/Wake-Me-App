/* eslint-disable no-console */
// Converts each mp3 in assets/sounds into a 28-second loop-padded WAV / CAF
// for use as iOS / Android notification sounds. Run once after adding or
// changing a source mp3:
//
//   node scripts/generate-notification-sounds.js
//
// Output:
//   assets/notification-sounds/<name>.wav   ← iOS / Android
//   assets/notification-sounds/<name>.caf   ← iOS (preferred container)
//
// iOS requirements: linear PCM, ≤ 30 s, packaged in aiff/wav/caf.

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const SRC = path.join(__dirname, '..', 'assets', 'sounds');
const OUT = path.join(__dirname, '..', 'assets', 'notification-sounds');
const DURATION = 28; // seconds; iOS cap is 30
const RATE = 44100;

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const sources = fs.readdirSync(SRC).filter(f => f.toLowerCase().endsWith('.mp3'));
if (sources.length === 0) {
  console.error('No mp3 files found in', SRC);
  process.exit(1);
}

for (const file of sources) {
  const name = path.basename(file, path.extname(file));
  const input = path.join(SRC, file);
  const wav = path.join(OUT, `${name}.wav`);
  const caf = path.join(OUT, `${name}.caf`);

  console.log(`→ ${name} (${file})`);
  // -stream_loop -1: loop input until -t cuts it; ensures we hit the full 28 s.
  // pcm_s16le + 44.1 kHz mono keeps file size reasonable and is iOS-safe.
  execFileSync(
    ffmpegPath,
    [
      '-y',
      '-stream_loop',
      '-1',
      '-i',
      input,
      '-t',
      String(DURATION),
      '-ac',
      '1',
      '-ar',
      String(RATE),
      '-c:a',
      'pcm_s16le',
      wav,
    ],
    { stdio: 'inherit' },
  );
  execFileSync(
    ffmpegPath,
    [
      '-y',
      '-stream_loop',
      '-1',
      '-i',
      input,
      '-t',
      String(DURATION),
      '-ac',
      '1',
      '-ar',
      String(RATE),
      '-c:a',
      'pcm_s16le',
      '-f',
      'caf',
      caf,
    ],
    { stdio: 'inherit' },
  );
}

console.log(`\nGenerated ${sources.length} notification sound(s) in ${OUT}`);
