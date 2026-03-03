/**
 * Create the Mage character in PixelLab (v2 API) from concept art description,
 * then poll until the character is ready. Prints the character_id for use with
 * queue and download scripts.
 *
 * Requires: PIXELLAB_API_TOKEN
 * Run: node scripts/create-pixellab-mage.js
 */

const https = require('https');

const CREATE_URL = 'https://api.pixellab.ai/v2/create-character-with-8-directions';

// Artstyle_DOC-aligned: darker, threatening hooded mage. 1px outline, top-left light, cel-shaded, muted palette.
const MAGE_DESCRIPTION = `Menacing dark mage, top-down pixel art. Deep black or near-black hood pulled forward, face in total shadow, no features visible. Heavy robe in very dark purple or charcoal, almost black; dull dark metal or iron trim only, no bright gold. Wide hood and voluminous sleeves, cuffs dark. Posture imposing or slightly hunched, threatening. Dark leather strap and belt, minimal buckle. Long robe to mid-calf, tattered or frayed hem. Dark boots. Single light source top-left, shadows bottom-right. 1px dark outline, cel-shaded 2-3 tones per material, no gradients. Muted medieval dark fantasy palette. Silhouette readable but sinister. Necromancer or dark caster vibe. No friendly or warm accents.`;

function postJson(url, body, token) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request(
      {
        hostname: urlObj.hostname,
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          Authorization: `Bearer ${token}`,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            const json = raw ? JSON.parse(raw) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) resolve(json);
            else reject(new Error(json.error || json.message || `HTTP ${res.statusCode}: ${raw}`));
          } catch (e) {
            reject(new Error(`HTTP ${res.statusCode}: ${raw}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(url, token) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request(
      {
        hostname: urlObj.hostname,
        path: urlObj.pathname,
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            const json = raw ? JSON.parse(raw) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) resolve(json);
            else reject(new Error(json.error || json.message || `HTTP ${res.statusCode}`));
          } catch (e) {
            reject(new Error(`HTTP ${res.statusCode}: ${raw}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const token = process.env.PIXELLAB_API_TOKEN;
  if (!token) {
    console.error('Set PIXELLAB_API_TOKEN');
    process.exit(1);
  }

  const body = {
    description: MAGE_DESCRIPTION,
    image_size: { width: 124, height: 124 },
    view: 'low top-down',
    detail: 'high',
  };

  console.log('Creating mage character (8 directions)...');
  const res = await postJson(CREATE_URL, body, token);
  const data = res.data != null ? res.data : res;
  const characterId = data.character_id || res.character_id;
  if (!characterId) {
    console.error('No character_id in response:', JSON.stringify(res, null, 2));
    process.exit(1);
  }
  console.log('Character ID:', characterId);

  const characterUrl = `https://api.pixellab.ai/v2/characters/${characterId}`;
  const maxWait = 5 * 60 * 1000;
  const pollMs = 15000;
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await sleep(pollMs);
    try {
      const charRes = await getJson(characterUrl, token);
      const c = charRes.data || charRes;
      const rotations = c.rotations || c.rotation_images || [];
      if (rotations.length >= 8) {
        console.log('Character ready (8 rotations).');
        console.log('');
        console.log('Next steps (queue starts at south; do not set PIXELLAB_START_AT):');
        console.log('1. Queue idle, run, walk (run each with the template set):');
        console.log(`   set PIXELLAB_CHARACTER_ID=${characterId}`);
        console.log('   set PIXELLAB_ANIMATION_TEMPLATE=breathing-idle');
        console.log('   npm run pixellab-queue-animation');
        console.log('   set PIXELLAB_ANIMATION_TEMPLATE=running-8-frames');
        console.log('   npm run pixellab-queue-animation');
        console.log('   set PIXELLAB_ANIMATION_TEMPLATE=walking-8-frames');
        console.log('   npm run pixellab-queue-animation');
        console.log('2. After animations complete, download:');
        console.log(`   set PIXELLAB_MAGE_CHARACTER_ID=${characterId}`);
        console.log('   set CHARACTER_OUTPUT=Mage');
        console.log('   npm run download-character');
        console.log('3. Add this ID to main.js / assets/Mage/PIXELLAB_MAGE.md for CDN.');
        process.exit(0);
      }
      console.log(`  Waiting for character... (${rotations.length}/8 rotations)`);
    } catch (e) {
      console.warn('  Poll failed:', e.message);
    }
  }
  console.log('Timed out waiting. Character may still be ready later. ID:', characterId);
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
