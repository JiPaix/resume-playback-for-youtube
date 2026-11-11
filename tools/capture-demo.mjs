// Records the README/AMO demos in a headless Firefox driven over WebDriver BiDi.
//
//   firefox --headless --no-remote --profile <throwaway dir> --remote-debugging-port=9333
//   node tools/capture-demo.mjs <frames dir> preview|resume
//
// The add-on is installed from this repo as a temporary add-on. YouTube's
// cookie consent page must already have been answered in that profile. Uses Blender Foundation open movies
// (CC BY) and hides unrelated results/recommendations while recording.

import { connect, sleep } from './bidi.mjs';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';

const [framesDir, which] = process.argv.slice(2);
const W = 1280, H = 800;

// Overlay injected in every page: fake mouse pointer, caption bar, hide CSS.
const OVERLAY = `() => {
  const install = () => {
    if (document.getElementById('__demo-cursor')) return;
    const css = document.createElement('style');
    css.textContent = \`
      #__demo-cursor { position: fixed; z-index: 2147483647; pointer-events: none; width: 26px; height: 26px;
        left: -50px; top: -50px; background: no-repeat center/contain url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M4 2l15 11-6.5 1 3.6 7.3-2.8 1.3-3.5-7.3L5 20z' fill='white' stroke='black' stroke-width='1.4' stroke-linejoin='round'/%3E%3C/svg%3E"); }
      #__demo-caption { position: fixed; z-index: 2147483646; left: 50%; bottom: 28px; transform: translateX(-50%);
        max-width: 94vw; white-space: nowrap; padding: 12px 22px; border-radius: 12px; background: rgba(20,24,33,.88); color: #fff;
        font: 600 22px system-ui, sans-serif; text-align: center; box-shadow: 0 6px 24px rgba(0,0,0,.35); }
      #__demo-caption:empty { display: none; }
      #__demo-caption b { color: #8fb6ff; }
      ytd-watch-flexy #secondary, ytd-watch-flexy ytd-comments { visibility: hidden !important; }
      .__demo-hide { visibility: hidden !important; }\`;
    const cursor = document.createElement('div'); cursor.id = '__demo-cursor';
    const caption = document.createElement('div'); caption.id = '__demo-caption';
    document.documentElement.append(css, cursor, caption);
    addEventListener('mousemove', (e) => { cursor.style.left = (e.clientX - 4) + 'px'; cursor.style.top = (e.clientY - 2) + 'px'; }, true);
  };
  // YouTube enforces Trusted Types (no innerHTML): build "text <b>bold</b> text" by hand.
  window.__demoCaption = (text) => {
    install();
    const box = document.getElementById('__demo-caption');
    box.replaceChildren();
    String(text || '').split(/<b>(.*?)<\\/b>/).forEach((part, i) => {
      if (!part) return;
      if (i % 2) { const bold = document.createElement('b'); bold.textContent = part; box.append(bold); }
      else box.append(document.createTextNode(part));
    });
  };
  if (document.documentElement) install(); else addEventListener('DOMContentLoaded', install);
}`;

// Screenshot loop: frames + real timestamps, so the GIF plays at true speed.
function recorder(b) {
  let ctx = null, on = false, n = 0, last = 0;
  const timings = [];
  const loop = async () => {
    while (on) {
      const t0 = Date.now();
      try {
        const png = await b.screenshot(ctx);
        const name = `f${String(++n).padStart(4, '0')}.png`;
        writeFileSync(`${framesDir}/${name}`, png);
        timings.push({ name, at: t0 });
      } catch { /* page navigating: skip a frame */ }
      const wait = 90 - (Date.now() - t0);
      if (wait > 0) await sleep(wait);
    }
  };
  return {
    use(c) { ctx = c; },
    start(c) { ctx = c; on = true; last = loop(); },
    async stop() { on = false; await last; },
    finish() {
      // ffmpeg concat list: each frame lasts until the next one was taken
      let list = '';
      timings.forEach((f, i) => {
        const next = timings[i + 1] ? timings[i + 1].at : f.at + 1500;
        list += `file '${f.name}'\nduration ${((next - f.at) / 1000).toFixed(3)}\n`;
      });
      list += `file '${timings.at(-1).name}'\n`;
      writeFileSync(`${framesDir}/frames.txt`, list);
      console.log(`${timings.length} frames, ${((timings.at(-1).at - timings[0].at) / 1000).toFixed(1)} s`);
    },
  };
}

const b = await connect();
rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });
const rec = recorder(b);
const caption = (ctx, html) => b.eval(ctx, `window.__demoCaption && window.__demoCaption(${JSON.stringify(html)})`).catch(() => {});
const mainTime = (ctx) => b.eval(ctx, `(() => { const v = document.querySelector('#movie_player video'); return v ? +v.currentTime.toFixed(1) : null })()`);
async function waitPlaying(ctx, minTime, maxMs = 25000) {
  const end = Date.now() + maxMs;
  while (Date.now() < end) {
    const t = await mainTime(ctx);
    if (t != null && t >= minTime) return t;
    await sleep(500);
  }
  throw new Error('video did not reach ' + minTime + ' s');
}
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

try {
  // (Re)install the add-on from this repo as a temporary add-on.
  const repo = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
  await b.send('webExtension.install', { extensionData: { type: 'path', path: repo } });
  await b.send('script.addPreloadScript', { functionDeclaration: OVERLAY });
  const ctx = await b.newTab();
  await b.send('browsingContext.setViewport', { context: ctx, viewport: { width: W, height: H } });

  // Theater mode (player full width), remembered by YouTube in the "wide" cookie.
  await b.goto(ctx, 'https://www.youtube.com/robots.txt');
  await b.eval(ctx, `document.cookie = 'wide=1; domain=.youtube.com; path=/; max-age=86400'`);

  if (which === 'preview') {
    await b.goto(ctx, 'https://www.youtube.com/results?search_query=sintel+open+movie+blender+foundation');
    await sleep(3000);
    // keep only the first result (the Blender upload), hide everything else
    const thumb = await b.eval(ctx, `(() => {
      const items = [...document.querySelectorAll('ytd-search #contents ytd-video-renderer, ytd-search #contents > *:not(ytd-item-section-renderer), ytd-search ytd-item-section-renderer #contents > *')];
      const first = document.querySelector('ytd-search ytd-video-renderer');
      for (const el of items) if (el !== first && !el.contains(first)) el.classList.add('__demo-hide');
      const r = first.querySelector('a#thumbnail, a[href*="/watch?v="]').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
    await b.mouse(ctx, 950, 600, { duration: 0 });
    rec.start(ctx);
    await caption(ctx, 'Hover a thumbnail: YouTube plays a preview');
    await sleep(1200);
    await b.mouse(ctx, thumb.x, thumb.y, { duration: 700 });
    await sleep(6500);
    await caption(ctx, 'Click it…');
    await sleep(600);
    const previewAt = await b.eval(ctx, `document.querySelector('#inline-preview-player video')?.currentTime ?? 0`);
    await b.mouse(ctx, thumb.x, thumb.y, { click: true, duration: 50 });
    await sleep(1500);
    // keep the player controls (and its clock) visible
    let t = null;
    for (let i = 0; i < 6; i++) {
      await b.mouse(ctx, 420 + (i % 2) * 30, 300, { duration: 300 });
      t = await mainTime(ctx);
      if (t != null && t > 1) await caption(ctx, `…the full video continues from <b>${fmt(previewAt)}</b> instead of restarting at 0:00`);
      await sleep(700);
    }
    console.log('preview was at', previewAt);
    await sleep(800);
    await rec.stop();
    console.log('watch page started at', t);
  }

  if (which === 'resume') {
    const URL = 'https://www.youtube.com/watch?v=YE7VzlLtp-4'; // Big Buck Bunny (Blender upload)
    // "watch" a while: jump to 0:40 and let it play so the position is saved.
    // (Headless YouTube only plays jumps inside its first ~60 s of buffer.)
    await b.goto(ctx, URL);
    await sleep(4000);
    // seek through YouTube's player API (setting video.currentTime directly stalls its buffering)
    await b.eval(ctx, `(() => { const p = document.getElementById('movie_player'); p.seekTo(40, true); p.playVideo(); })()`);
    await waitPlaying(ctx, 42);
    await sleep(3000);
    await b.mouse(ctx, 400, 300, { duration: 0 });
    rec.start(ctx);
    for (let i = 0; i < 4; i++) {
      await caption(ctx, 'Watching a video…');
      await b.mouse(ctx, 400 + (i % 2) * 30, 300, { duration: 300 });
      await sleep(600);
    }
    const stoppedAt = await mainTime(ctx);
    await caption(ctx, `Close the tab at <b>${fmt(stoppedAt)}</b>`);
    await sleep(1200);
    await rec.stop();

    // tab closed; "later", a new tab opens the same video
    const ctx2 = await b.newTab();
    await b.send('browsingContext.setViewport', { context: ctx2, viewport: { width: W, height: H } });
    await b.send('browsingContext.close', { context: ctx });
    await b.goto(ctx2, 'data:text/html,' + encodeURIComponent(
      '<meta charset="utf-8"><body style="margin:0;height:100vh;display:grid;place-items:center;background:#0f1115;color:#fff;font:600 34px system-ui">Later… open the same video again</body>'));
    rec.start(ctx2);
    await sleep(1800);
    rec.use(ctx2);
    await b.goto(ctx2, URL);
    let t = null, playingSince = 0;
    for (let i = 0; i < 30; i++) {
      await b.mouse(ctx2, 420 + (i % 2) * 30, 300, { duration: 300 });
      const now = await mainTime(ctx2);
      if (now != null && now > 30) await caption(ctx2, `It continues where you left off: <b>${fmt(stoppedAt)}</b>`);
      if (t != null && now > t && !playingSince) playingSince = Date.now();
      t = now;
      if (playingSince && Date.now() - playingSince > 3500) break;
      await sleep(300);
    }
    await rec.stop();
    console.log('stopped at', stoppedAt, 'reopened at', t);
  }
  rec.finish();
} finally {
  await b.close();
}
