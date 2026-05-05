/**
 * Download PixelLab character ZIP and extract:
 * - breathing-idle (all 8 directions)
 * - run animation (all 8 directions)
 * - walk animation (all 8 directions; used when player is dazed)
 *
 * Uses v2 API: GET /characters/{id}/zip (Bearer token). If 423, wait and re-run.
 *
 * Requires: PIXELLAB_API_TOKEN (get from https://api.pixellab.ai/mcp)
 * Optional env overrides:
 *   PIXELLAB_KNIGHT_CHARACTER_ID  – knight UUID (default when CHARACTER_OUTPUT not set)
 *   PIXELLAB_MAGE_CHARACTER_ID    – mage UUID (required when CHARACTER_OUTPUT=Mage)
 *   CHARACTER_OUTPUT             – "Mage" to download mage to assets/Mage (mage_idle, mage_run, mage_walk)
 *   RUN_ANIMATION_FOLDER         – run folder in ZIP (default: running-8-frames)
 *   WALK_ANIMATION_FOLDER         – walk folder in ZIP (default: walking-8-frames)
 *
 * Knight: npm run download-knight-idle
 * Mage:   set CHARACTER_OUTPUT=Mage & set PIXELLAB_MAGE_CHARACTER_ID=<id> & npm run download-character
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const CHARACTER_OUTPUT = (process.env.CHARACTER_OUTPUT || '').toLowerCase();
const isMage = CHARACTER_OUTPUT === 'mage';
const CHARACTER_ID = isMage
  ? (process.env.PIXELLAB_MAGE_CHARACTER_ID || process.env.PIXELLAB_CHARACTER_ID)
  : (process.env.PIXELLAB_KNIGHT_CHARACTER_ID || '60a256f7-b45d-44c2-a0f5-4fd52a9a3f9f');
const RUN_ANIMATION_FOLDER = process.env.RUN_ANIMATION_FOLDER || 'running-8-frames';
const WALK_ANIMATION_FOLDER = process.env.WALK_ANIMATION_FOLDER || 'walking-8-frames';
const ASSET_PREFIX = isMage ? 'mage' : 'knight';
const ASSET_FOLDER = isMage ? 'Mage' : 'Knight';
// v2 API: GET /characters/{character_id}/zip
const DOWNLOAD_URL = `https://api.pixellab.ai/v2/characters/${CHARACTER_ID}/zip`;

const ALL_DIRECTIONS = ['south', 'east', 'north', 'west', 'south-east', 'north-east', 'north-west', 'south-west'];

function fetchZip(token) {
  return new Promise((resolve, reject) => {
    const url = new URL(DOWNLOAD_URL);
    const req = https.get(
      url,
      { headers: { Authorization: `Bearer ${token}` } },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          if (res.statusCode === 423) {
            reject(new Error('Character ZIP not ready (423). Animations may still be generating. Try again in a few minutes.'));
            return;
          }
          if (res.statusCode !== 200) {
            let msg = body.toString('utf8').slice(0, 200);
            try {
              const j = JSON.parse(body);
              msg = j.error || j.message || msg;
            } catch (_) {}
            reject(new Error(`Download failed: ${res.statusCode} ${res.statusMessage}. ${msg}`));
            return;
          }
          resolve(body);
        });
        res.on('error', reject);
      }
    );
    req.on('error', reject);
  });
}

function extractAnimationFrames(zipBuffer, animFolder, direction) {
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  const escapedDir = direction.replace(/-/g, '\\-');
  const pattern = new RegExp(`${animFolder}[\\\\/]${escapedDir}[\\\\/].*\\.png$`, 'i');
  const framePattern = /(\d+)\.png$/;
  const matches = entries
    .filter((e) => !e.isDirectory && pattern.test(e.entryName))
    .map((e) => {
      const m = e.entryName.match(framePattern);
      return { index: m ? parseInt(m[1], 10) : -1, entry: e };
    })
    .filter((o) => o.index >= 0);

  if (matches.length === 0) {
    const pngs = entries.filter((e) => !e.isDirectory && e.entryName.endsWith('.png')).map((e) => e.entryName);
    throw new Error(`No ${animFolder}/${direction}/*.png in ZIP. PNGs: ` + pngs.slice(0, 20).join(', '));
  }

  matches.sort((a, b) => a.index - b.index);
  return matches.map((m) => m.entry);
}

function main() {
  const token = process.env.PIXELLAB_API_TOKEN;
  if (!token) {
    console.error('Set PIXELLAB_API_TOKEN (get it from https://api.pixellab.ai/mcp)');
    process.exit(1);
  }

  if (isMage && !CHARACTER_ID) {
    console.error('Set PIXELLAB_MAGE_CHARACTER_ID (or PIXELLAB_CHARACTER_ID) when CHARACTER_OUTPUT=Mage');
    process.exit(1);
  }
  console.log('Character:', isMage ? 'Mage' : 'Knight');
  console.log('Character ID:', CHARACTER_ID);
  console.log('Downloading character ZIP...');
  fetchZip(token)
    .then((buf) => {
      if (buf.length < 1000) {
        throw new Error('ZIP too small – might be an error response. Check token and character ID.');
      }
      const assetsBase = path.join(__dirname, '..', 'src', 'assets', ASSET_FOLDER);
      const baseOut = path.join(assetsBase, `${ASSET_PREFIX}_idle`);
      for (const dir of ALL_DIRECTIONS) {
        const outDir = path.join(baseOut, `${ASSET_PREFIX}_idle_${dir}`);
        try {
          const frames = extractAnimationFrames(buf, 'breathing-idle', dir);
          if (frames.length < 4) console.warn(`Only ${frames.length} ${dir} idle frames; expected 4.`);
          fs.mkdirSync(outDir, { recursive: true });
          frames.forEach((entry, i) => {
            const outPath = path.join(outDir, `${i}.png`);
            fs.writeFileSync(outPath, entry.getData());
            console.log('Wrote', outPath);
          });
          console.log(`Idle ${dir} saved to src/assets/${ASSET_FOLDER}/${ASSET_PREFIX}_idle/${ASSET_PREFIX}_idle_${dir}/`);
        } catch (e) {
          console.warn(`idle ${dir}:`, e.message);
        }
      }
      const runBase = path.join(assetsBase, `${ASSET_PREFIX}_run`);
      console.log(`Run animation folder in ZIP: ${RUN_ANIMATION_FOLDER}`);
      for (const dir of ALL_DIRECTIONS) {
        try {
          const frames = extractAnimationFrames(buf, RUN_ANIMATION_FOLDER, dir);
          const outDir = path.join(runBase, `${ASSET_PREFIX}_run_${dir}`);
          fs.mkdirSync(outDir, { recursive: true });
          frames.forEach((entry, i) => {
            const outPath = path.join(outDir, `${i}.png`);
            fs.writeFileSync(outPath, entry.getData());
            console.log('Wrote', outPath);
          });
          console.log(`Run ${dir} saved to src/assets/${ASSET_FOLDER}/${ASSET_PREFIX}_run/${ASSET_PREFIX}_run_${dir}/ (${frames.length} frames)`);
        } catch (e) {
          console.warn(`Run ${dir}:`, e.message);
        }
      }
      const walkBase = path.join(assetsBase, `${ASSET_PREFIX}_walk`);
      console.log(`Walk animation folder in ZIP: ${WALK_ANIMATION_FOLDER}`);
      for (const dir of ALL_DIRECTIONS) {
        try {
          const frames = extractAnimationFrames(buf, WALK_ANIMATION_FOLDER, dir);
          const outDir = path.join(walkBase, `${ASSET_PREFIX}_walk_${dir}`);
          fs.mkdirSync(outDir, { recursive: true });
          frames.forEach((entry, i) => {
            const outPath = path.join(outDir, `${i}.png`);
            fs.writeFileSync(outPath, entry.getData());
            console.log('Wrote', outPath);
          });
          console.log(`Walk ${dir} saved to src/assets/${ASSET_FOLDER}/${ASSET_PREFIX}_walk/${ASSET_PREFIX}_walk_${dir}/ (${frames.length} frames)`);
        } catch (e) {
          console.warn(`Walk ${dir}:`, e.message);
        }
      }
      console.log('Done.');
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}

main();
