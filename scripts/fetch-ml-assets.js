#!/usr/bin/env node
/* eslint-disable */
/**
 * Downloads a MobileNet TFLite image classifier + ImageNet labels into assets/ml/.
 *
 * Run once after a fresh checkout:
 *   node scripts/fetch-ml-assets.js
 *
 * Outputs:
 *   assets/ml/mobilenet.tflite        – uint8-quantised MobileNet V2 1.0 224 from the TF release bucket.
 *                                       Input [1,224,224,3] uint8, output [1,1001] uint8 logits.
 *                                       Bundle this with the app via require('...mobilenet.tflite').
 *   assets/ml/imagenet_labels.json    – array of 1001 strings, index → class name.
 *                                       Index 0 is "background", indices 1..1000 are ImageNet-1k.
 *
 * The MobileNet V3 small URL on tfhub-lite-models is gated (403); the V2 tarball below is the
 * canonical, freely-redistributable TFLite that has worked for years. Same I/O contract as V3
 * for our purposes — top-5 ImageNet logits — so the rest of the pipeline is unaffected.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'ml');
const MODEL_OUT = path.join(OUT_DIR, 'mobilenet.tflite');
const LABELS_OUT = path.join(OUT_DIR, 'imagenet_labels.json');

const MODEL_TGZ_URL =
  'https://storage.googleapis.com/download.tensorflow.org/models/tflite_11_05_08/mobilenet_v2_1.0_224_quant.tgz';
const MODEL_FILE_IN_TGZ = 'mobilenet_v2_1.0_224_quant.tflite';

const LABELS_URL =
  'https://storage.googleapis.com/download.tensorflow.org/data/imagenet_class_index.json';

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, res => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(dest);
          return resolve(download(res.headers.location, dest));
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
      })
      .on('error', err => {
        file.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        reject(err);
      });
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const tgz = path.join(OUT_DIR, 'mobilenet.tgz');
  console.log('[fetch-ml-assets] downloading MobileNet tarball ->', tgz);
  await download(MODEL_TGZ_URL, tgz);

  console.log('[fetch-ml-assets] extracting .tflite ...');
  execSync(`tar -xzf ${JSON.stringify(tgz)} -C ${JSON.stringify(OUT_DIR)} ${MODEL_FILE_IN_TGZ}`, {
    stdio: 'inherit',
  });
  fs.renameSync(path.join(OUT_DIR, MODEL_FILE_IN_TGZ), MODEL_OUT);
  fs.unlinkSync(tgz);

  const tmpLabels = LABELS_OUT + '.raw.json';
  console.log('[fetch-ml-assets] downloading ImageNet labels ->', tmpLabels);
  await download(LABELS_URL, tmpLabels);

  // imagenet_class_index.json: { "0": ["n01440764", "tench"], ..., "999": [...] } (1000 classes, 0-indexed).
  // MobileNet TFLite outputs 1001 logits where output[0] is "background" and output[i+1] maps to class i.
  const raw = JSON.parse(fs.readFileSync(tmpLabels, 'utf8'));
  const labels = new Array(1001).fill('background');
  for (const key of Object.keys(raw)) {
    const idx = Number(key);
    const entry = raw[key];
    const name = Array.isArray(entry) ? entry[1] : String(entry);
    labels[idx + 1] = String(name).replace(/_/g, ' ');
  }
  fs.writeFileSync(LABELS_OUT, JSON.stringify(labels));
  fs.unlinkSync(tmpLabels);

  console.log('[fetch-ml-assets] done.');
  console.log('  model :', MODEL_OUT, `(${fs.statSync(MODEL_OUT).size} bytes)`);
  console.log('  labels:', LABELS_OUT, `(${labels.length} classes)`);
}

main().catch(err => {
  console.error('[fetch-ml-assets] FAILED:', err.message);
  process.exit(1);
});
