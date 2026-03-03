/**
 * Queue a PixelLab character animation one direction at a time.
 * - Before each direction: GET character and skip that direction if it's already finished for this template. Matching uses naming conventions: e.g. template or PIXELLAB_ANIMATION_NAME "dash" matches character animations named "dash", "dashing", etc.
 * - Between each request: waits 10s, then checks job status; if 3+ jobs in progress, waits 20s and
 *   rechecks until fewer than 3, then queues the next direction.
 *
 * Order: south → south-east → east → north-east → north → north-west → west → south-west
 *
 * Requires: PIXELLAB_API_TOKEN (get from https://api.pixellab.ai/mcp)
 * Optional env:
 *   PIXELLAB_CHARACTER_ID         – character UUID (overrides knight ID; use for Mage)
 *   PIXELLAB_KNIGHT_CHARACTER_ID  – character UUID (default Knight)
 *   PIXELLAB_ANIMATION_TEMPLATE   – template_animation_id (e.g. running-8-frames, walking-8-frames)
 *   PIXELLAB_ACTION_DESCRIPTION   – for custom template: action text
 *   PIXELLAB_ANIMATION_NAME       – optional name for this animation
 *   PIXELLAB_START_AT             – resume from this direction (1–8 or direction name, e.g. 4 or north-east)
 *   PIXELLAB_SKIP_BUSY_CHECK      – set to 1 to queue even when character has jobs in progress
 *   PIXELLAB_WAIT_FOR_JOBS        – set to 1 to wait (poll every 60s) until no jobs in progress, then queue (max 15 min)
 *   PIXELLAB_DEBUG                – set to 1 to log character API response keys and pending count source (stderr)
 *
 * Example – resume from north-east (after south, south-east, east already queued):
 *   set PIXELLAB_ANIMATION_TEMPLATE=walking-8-frames
 *   set PIXELLAB_START_AT=4
 *   npm run pixellab-queue-animation
 *
 * Example – queue custom "dash" animation:
 *   set PIXELLAB_ANIMATION_TEMPLATE=custom
 *   set PIXELLAB_ACTION_DESCRIPTION=dashing forward
 *   set PIXELLAB_ANIMATION_NAME=dash
 *   npm run pixellab-queue-animation
 *
 * Run: node scripts/pixellab-queue-animation-directions.js
 */

const https = require('https');

const CHARACTER_ID = process.env.PIXELLAB_CHARACTER_ID || process.env.PIXELLAB_KNIGHT_CHARACTER_ID || '60a256f7-b45d-44c2-a0f5-4fd52a9a3f9f';
const TEMPLATE_ANIMATION_ID = process.env.PIXELLAB_ANIMATION_TEMPLATE || 'running-8-frames';
const ACTION_DESCRIPTION = process.env.PIXELLAB_ACTION_DESCRIPTION || null;
const ANIMATION_NAME = process.env.PIXELLAB_ANIMATION_NAME || null;

// One direction per request, in order: south first, then clockwise
const DIRECTION_ORDER = [
  'south',
  'south-east',
  'east',
  'north-east',
  'north',
  'north-west',
  'west',
  'south-west',
];

const DELAY_MS = 10 * 1000; // 10 seconds between requests
const BUSY_POLL_MS = 60 * 1000; // 1 minute when waiting for jobs to finish
const BUSY_WAIT_MAX_MS = 15 * 60 * 1000; // stop waiting after 15 minutes
const PENDING_THRESHOLD = 3; // only queue next when pending jobs < this
const PENDING_WAIT_MS = 20 * 1000; // wait 20s then recheck when pending >= threshold

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
            else reject(new Error(json.error || json.message || `HTTP ${res.statusCode}: ${raw}`));
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
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(json);
            } else {
              reject(new Error(json.error || json.message || `HTTP ${res.statusCode}: ${raw}`));
            }
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DEBUG = process.env.PIXELLAB_DEBUG === '1';

/** Return number of jobs in progress for this character (0 if unknown or none). */
function getPendingJobCount(characterResponse) {
  if (DEBUG && characterResponse) {
    const keys = Object.keys(characterResponse);
    const dataKeys = characterResponse.data ? Object.keys(characterResponse.data) : [];
    console.error('[DEBUG] character response keys:', keys.join(', '));
    if (characterResponse.data) console.error('[DEBUG] data keys:', dataKeys.join(', '));
    if (characterResponse.data && characterResponse.data.animations) {
      const statuses = characterResponse.data.animations.slice(0, 3).map((a) => a.status || a.state);
      console.error('[DEBUG] first animation statuses:', statuses);
    }
  }
  const data = characterResponse.data != null ? characterResponse.data : characterResponse;
  if (!data) return 0;
  const pending = data.pending_jobs || data.pending_animation_jobs || data.background_jobs || data.pending_background_jobs;
  if (Array.isArray(pending)) return pending.length;
  if (typeof pending === 'number') return pending;
  const anims = data.animations;
  if (Array.isArray(anims)) {
    const inProgress = anims.filter((a) => (a.status || a.state || '') === 'processing' || (a.status || a.state || '') === 'pending');
    return inProgress.length;
  }
  return 0;
}

/** GET /background-jobs/{job_id} and return status string, or null on error. */
async function getBackgroundJobStatus(jobId, token) {
  if (!jobId) return null;
  const jobUrl = `https://api.pixellab.ai/v2/background-jobs/${jobId}`;
  try {
    const res = await getJson(jobUrl, token);
    const data = res.data != null ? res.data : res;
    return data.status || data.state || null;
  } catch (e) {
    if (DEBUG) console.error('[DEBUG] getBackgroundJobStatus', jobId, e.message);
    return null;
  }
}

/** Count how many of the given job IDs are still in progress (not completed/failed). */
async function countPendingJobs(jobIds, token) {
  if (!jobIds.length) return 0;
  let pending = 0;
  const terminal = ['completed', 'failed', 'done', 'success'];
  for (const id of jobIds) {
    const status = await getBackgroundJobStatus(id, token);
    if (status == null || !terminal.includes(String(status).toLowerCase())) pending += 1;
  }
  return pending;
}

/** True if character animation name matches our template (exact or naming convention: e.g. "dash" matches "dash", "dashing"). */
function templateNameMatches(animNameNorm, templateNorm) {
  if (!animNameNorm || !templateNorm) return false;
  if (animNameNorm === templateNorm) return true;
  const minLen = 2;
  if (templateNorm.length >= minLen && animNameNorm.includes(templateNorm)) return true;
  if (animNameNorm.length >= minLen && templateNorm.includes(animNameNorm)) return true;
  return false;
}

/** Return a Set of direction names that already have this animation (finished) for the given template.
 *  Matches by template ID and, if provided, by animation display name (e.g. "dash" so "dash"/"dashing" on character page match). */
function getFinishedDirectionsForTemplate(characterResponse, templateId, animationNameOptional) {
  const out = new Set();
  const data = characterResponse.data != null ? characterResponse.data : characterResponse;
  if (!data) return out;
  const norm = (s) => String(s).toLowerCase().replace(/_/g, '-');
  const templateNorm = norm(templateId);
  const nameNormOpt = animationNameOptional ? norm(animationNameOptional) : null;

  const matches = (nameNorm) =>
    templateNameMatches(nameNorm, templateNorm) ||
    (nameNormOpt && templateNameMatches(nameNorm, nameNormOpt));

  // data.animations as array: [{ template_animation_id, directions: [], status? }, ...]
  const anims = data.animations;
  if (Array.isArray(anims)) {
    for (const anim of anims) {
      const name = anim.template_animation_id || anim.template_id || anim.name || anim.id || anim.folder_name || '';
      const nameNorm = norm(name);
      if (!nameNorm || !matches(nameNorm)) continue;
      const status = (anim.status || anim.state || '').toLowerCase();
      if (status && !['completed', 'done', 'success', ''].includes(status)) continue; // skip in-progress/failed
      const dirs = anim.directions;
      if (Array.isArray(dirs)) dirs.forEach((d) => out.add(norm(d)));
      else if (dirs && typeof dirs === 'object') Object.keys(dirs).forEach((d) => out.add(norm(d)));
    }
  }

  // data.animations as object: { "walking-8-frames": { south: [...] }, "dash": { ... } }
  if (data.animations && typeof data.animations === 'object' && !Array.isArray(data.animations)) {
    for (const key of Object.keys(data.animations)) {
      const keyNorm = norm(key);
      if (!matches(keyNorm)) continue;
      const byDir = data.animations[key];
      if (byDir && typeof byDir === 'object') Object.keys(byDir).forEach((d) => out.add(norm(d)));
    }
  }

  if (DEBUG && out.size > 0) console.error('[DEBUG] Finished directions for', templateId, ':', [...out].join(', '));
  return out;
}

async function main() {
  const token = process.env.PIXELLAB_API_TOKEN;
  if (!token) {
    console.error('Set PIXELLAB_API_TOKEN (get it from https://api.pixellab.ai/mcp)');
    process.exit(1);
  }

  const skipBusyCheck = process.env.PIXELLAB_SKIP_BUSY_CHECK === '1';
  const waitForJobs = process.env.PIXELLAB_WAIT_FOR_JOBS === '1';
  const characterUrl = `https://api.pixellab.ai/v2/characters/${CHARACTER_ID}`;

  if (!skipBusyCheck) {
    let pending = 0;
    try {
      const charRes = await getJson(characterUrl, token);
      pending = getPendingJobCount(charRes);
    } catch (err) {
      console.warn('Could not check character status:', err.message);
    }
    if (pending > 0) {
      if (waitForJobs) {
        console.log(`Character has ${pending} job(s) in progress. Waiting (poll every ${BUSY_POLL_MS / 1000}s, max ${BUSY_WAIT_MAX_MS / 60000} min)...`);
        const deadline = Date.now() + BUSY_WAIT_MAX_MS;
        while (Date.now() < deadline) {
          await sleep(BUSY_POLL_MS);
          try {
            const charRes = await getJson(characterUrl, token);
            pending = getPendingJobCount(charRes);
            if (pending === 0) {
              console.log('No jobs in progress. Proceeding to queue.\n');
              break;
            }
            console.log(`  Still ${pending} job(s) in progress...`);
          } catch (e) {
            console.warn('  Status check failed:', e.message);
          }
        }
        if (pending > 0) {
          console.error('Still busy after wait. Run again later or set PIXELLAB_SKIP_BUSY_CHECK=1 to queue anyway.');
          process.exit(1);
        }
      } else {
        console.error(`Character has ${pending} job(s) in progress. Wait and re-run, or set PIXELLAB_WAIT_FOR_JOBS=1 to wait automatically, or PIXELLAB_SKIP_BUSY_CHECK=1 to queue anyway.`);
        process.exit(1);
      }
    }
  }

  const url = 'https://api.pixellab.ai/v2/characters/animations';
  let startIndex = 0;
  // When using PIXELLAB_CHARACTER_ID (e.g. Mage), always start at south; ignore PIXELLAB_START_AT
  const forceStartAtSouth = !!process.env.PIXELLAB_CHARACTER_ID;
  const startAt = forceStartAtSouth ? undefined : process.env.PIXELLAB_START_AT;
  if (startAt) {
    const n = parseInt(startAt, 10);
    if (!isNaN(n) && n >= 1 && n <= 8) {
      startIndex = n - 1;
      console.log('Resuming from direction', n, `(${DIRECTION_ORDER[startIndex]})`);
    } else {
      const dir = String(startAt).toLowerCase().replace('_', '-');
      const i = DIRECTION_ORDER.indexOf(dir);
      if (i >= 0) {
        startIndex = i;
        console.log('Resuming from direction', dir);
      }
    }
  } else if (forceStartAtSouth) {
    console.log('Starting from south (full 8 directions for this character).');
  }
  const directionsToQueue = DIRECTION_ORDER.slice(startIndex);
  console.log('Character ID:', CHARACTER_ID);
  console.log('Template animation:', TEMPLATE_ANIMATION_ID);
  if (ACTION_DESCRIPTION) console.log('Action description:', ACTION_DESCRIPTION);
  if (ANIMATION_NAME) console.log('Animation name:', ANIMATION_NAME);
  console.log('Directions to queue:', directionsToQueue.join(' → '));
  console.log('Delay between requests:', DELAY_MS / 1000, 'seconds');
  console.log('');

  /** Job IDs returned from POST /characters/animations; we poll these for accurate pending count. */
  const queuedJobIds = [];

  for (let i = 0; i < directionsToQueue.length; i++) {
    const direction = directionsToQueue[i];
    const oneBased = startIndex + i + 1;

    // Before queuing: check if this direction is already finished for this template (match by template ID or animation name, e.g. "dash")
    try {
      const charRes = await getJson(characterUrl, token);
      const finished = getFinishedDirectionsForTemplate(charRes, TEMPLATE_ANIMATION_ID, ANIMATION_NAME);
      const dirNorm = direction.toLowerCase().replace('_', '-');
      if (finished.has(dirNorm)) {
        console.log(`[${oneBased}/8] Skipping ${direction} (already finished for ${TEMPLATE_ANIMATION_ID})`);
        continue;
      }
    } catch (e) {
      console.warn(`  Could not check finished directions: ${e.message}; will queue anyway.`);
    }

    console.log(`[${oneBased}/8] Queuing ${TEMPLATE_ANIMATION_ID} (${direction})...`);
    try {
      const body = {
        character_id: CHARACTER_ID,
        template_animation_id: TEMPLATE_ANIMATION_ID,
        directions: [direction],
      };
      if (ACTION_DESCRIPTION) body.action_description = ACTION_DESCRIPTION;
      if (ANIMATION_NAME) body.animation_name = ANIMATION_NAME;
      const res = await postJson(url, body, token);
      const data = res.data != null ? res.data : res;
      const ids = data.background_job_ids || (data.background_job_id ? [data.background_job_id] : []) || (data.job_id ? [data.job_id] : []);
      if (ids.length) {
        ids.forEach((id) => queuedJobIds.push(id));
        console.log('  OK: job_id(s)', ids.join(', '));
      } else {
        console.log('  OK:', JSON.stringify(data));
        if (DEBUG) console.error('[DEBUG] No background_job_id(s) in response; keys:', data ? Object.keys(data) : []);
      }
    } catch (err) {
      console.error('  Error:', err.message);
      console.error('  Stopping. Fix the error and re-run to continue from the next direction.');
      process.exit(1);
    }
    if (i < directionsToQueue.length - 1) {
      console.log(`  Waiting ${DELAY_MS / 1000}s before next request...`);
      await sleep(DELAY_MS);
      // Wait until fewer than PENDING_THRESHOLD jobs in progress, then queue next
      let pending = 0;
      do {
        if (queuedJobIds.length > 0) {
          pending = await countPendingJobs(queuedJobIds, token);
          if (DEBUG) console.error('[DEBUG] Pending (from job IDs):', pending);
        } else {
          try {
            const charRes = await getJson(characterUrl, token);
            pending = getPendingJobCount(charRes);
            if (DEBUG) console.error('[DEBUG] Pending (from character):', pending);
          } catch (e) {
            console.warn('  Status check failed:', e.message);
            pending = 0;
          }
        }
        console.log(`  Pending jobs: ${pending} (will queue next when < ${PENDING_THRESHOLD})`);
        if (pending >= PENDING_THRESHOLD) {
          console.log(`  Waiting ${PENDING_WAIT_MS / 1000}s before recheck...`);
          await sleep(PENDING_WAIT_MS);
        }
      } while (pending >= PENDING_THRESHOLD);
    }
  }

  console.log('');
  console.log('Done. Queued', directionsToQueue.length, 'direction(s). Check status with get_character(character_id="' + CHARACTER_ID + '")');
}

main();
