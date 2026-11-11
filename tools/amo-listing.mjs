// Keep the addons.mozilla.org listing's media in sync with the repo:
// - tags (AMO's fixed list: GET /api/v5/addons/tags/)
// - icon (docs/icon-128.png), uploaded while the listing still has the default icon
// - screenshots: only the missing ones (if the listing has N, N+1.. are uploaded)
// Needs AMO API credentials in the environment: WEB_EXT_API_KEY / WEB_EXT_API_SECRET,
// or AMO_JWT_ISSUER / AMO_JWT_SECRET, e.g.
//   node --env-file ~/.mozilla/AMO_JWT tools/amo-listing.mjs
// Docs: https://mozilla.github.io/addons-server/topics/api/addons.html#preview-create

import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const API = 'https://addons.mozilla.org/api/v5';
const root = new URL('..', import.meta.url).pathname;
const id = JSON.parse(readFileSync(root + 'manifest.json', 'utf8')).browser_specific_settings.gecko.id;

const TAGS = ['youtube', 'streaming'];
const ICON = 'docs/icon-128.png';

const SCREENSHOTS = [
  ['docs/screenshots/1-hover-preview.png', 'Hover a thumbnail: YouTube plays a preview.'],
  ['docs/screenshots/2-continues-from-preview.png', 'Click it: the full video continues from the preview instead of restarting at 0:00.'],
  ['docs/screenshots/3-resumes-where-you-left-off.png', 'Close a video, open it again later: it continues where you left off.'],
];

function jwt() {
  const env = process.env;
  const key = (env.WEB_EXT_API_KEY || env.AMO_JWT_ISSUER || '').trim();
  const secret = (env.WEB_EXT_API_SECRET || env.AMO_JWT_SECRET || '').trim();
  if (!key || !secret) throw new Error('AMO API key/secret not set');
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const iat = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: key, jti: randomUUID(), iat, exp: iat + 60 })}`;
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, path, body) {
  const json = body && !(body instanceof FormData);
  for (let attempt = 1; ; attempt++) {
    const headers = { Authorization: `JWT ${jwt()}` };
    if (json) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${API}${path}`, { method, headers, body: json ? JSON.stringify(body) : body });
    const text = await res.text();
    if (res.status === 429 && attempt <= 5) {
      // "Request was throttled. Expected available in 57 seconds."
      const wait = Number((text.match(/available in (\d+) second/) || [])[1] || 60) + 2;
      console.log(`rate limited, waiting ${wait} s`);
      await sleep(wait * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  }
}

const ADDON = `/addons/addon/${encodeURIComponent(id)}/`;
const addon = await api('GET', ADDON);

if ([...(addon.tags || [])].sort().join() !== [...TAGS].sort().join()) {
  await api('PATCH', ADDON, { tags: TAGS });
  console.log(`tags set: ${TAGS.join(', ')}`);
}

// AMO serves a generic default icon until one is uploaded
const icon = Object.values(addon.icons || {})[0] || addon.icon_url || '';
if (!icon || /default/.test(icon)) {
  const form = new FormData();
  form.append('icon', new Blob([readFileSync(root + ICON)], { type: 'image/png' }), basename(ICON));
  await api('PATCH', ADDON, form);
  console.log('icon uploaded');
}

const existing = addon.previews?.length || 0;
if (existing >= SCREENSHOTS.length) {
  console.log(`${existing} screenshot(s) already on AMO.`);
  process.exit(0);
}

for (const [i, [file, caption]] of SCREENSHOTS.entries()) {
  if (i < existing) continue; // already uploaded
  const form = new FormData();
  form.append('image', new Blob([readFileSync(root + file)], { type: 'image/png' }), basename(file));
  form.append('position', String(i));
  const preview = await api('POST', `${ADDON}previews/`, form);
  await api('PATCH', `${ADDON}previews/${preview.id}/`, {
    caption: { 'en-US': caption }, position: i,
  });
  console.log(`uploaded ${file}`);
}
