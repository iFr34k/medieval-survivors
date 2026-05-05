/**
 * List your PixelLab characters and find one by name (e.g. "Mage").
 * Requires: PIXELLAB_API_TOKEN
 * Run: node scripts/list-pixellab-characters.js
 * Optional: PIXELLAB_SEARCH_NAME=Mage  (default: Mage)
 */

const https = require('https');

const LIST_URL = 'https://api.pixellab.ai/v2/characters?limit=100';
const SEARCH_NAME = (process.env.PIXELLAB_SEARCH_NAME || 'Mage').toLowerCase();

function getJson(url, token) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request(
      {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
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

async function main() {
  const token = process.env.PIXELLAB_API_TOKEN;
  if (!token) {
    console.error('Set PIXELLAB_API_TOKEN');
    process.exit(1);
  }

  const res = await getJson(LIST_URL, token);
  const list = res.data != null ? res.data : res;
  const chars = Array.isArray(list) ? list : (list.characters || list.results || []);
  if (!chars.length) {
    console.log('No characters returned.');
    process.exit(0);
  }

  console.log('All characters:', chars.length);
  chars.forEach((c, i) => {
    const id = c.id || c.character_id;
    const name = (c.name || c.description || '').toString();
    console.log(`  ${i + 1}. ${id}  ${name || '(no name)'}`);
  });

  const match = chars.find((c) => {
    const name = (c.name || c.description || '').toString().toLowerCase();
    return name.includes(SEARCH_NAME);
  });

  if (match) {
    const id = match.id || match.character_id;
    console.log('');
    console.log(`Found "${SEARCH_NAME}": ${id}`);
    console.log('Set in project:');
    console.log(`  main.js: PIXELLAB_MAGE_CHARACTER_ID = '${id}'`);
    console.log(`  Queue: PIXELLAB_CHARACTER_ID=${id}`);
  } else {
    console.log('');
    console.log(`No character name containing "${SEARCH_NAME}" found. Check the list above.`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
