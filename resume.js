'use strict';
// Video Resumer (jipai): remembers where you stopped in a YouTube video and
// resumes there next time. No polling: it only listens to the media events of
// YouTube's main player (#movie_player), so hover previews and ads are ignored.

(() => {
  // Ignore the second injection on youtube.com/embed (matched by both entries).
  if (window.__videoResumerLoaded) return;
  window.__videoResumerLoaded = true;

  const SAVE_EVERY_MS = 5000;   // periodic save while playing
  const MIN_DURATION = 60;      // don't track videos shorter than this (s)
  const MIN_POSITION = 10;      // closer to the start than this = nothing to resume
  const END_MARGIN = 15;        // closer to the end than this = finished, forget it
  const FORGET_AFTER_DAYS = 60; // drop entries not touched for this long
  const PREVIEW_CONTAINERS = '#video-preview, ytd-video-preview, ytd-inline-player';

  const store = browser.storage.local;
  const key = (id) => 'v:' + id;

  // The main video currently being tracked.
  // { id, video, ready (resume attempt finished), lastSave }
  let current = null;

  // ---------- helpers ----------

  function urlVideoId() {
    const u = new URL(location.href);
    if (u.pathname === '/watch') return u.searchParams.get('v');
    const m = u.pathname.match(/^\/(?:embed|live)\/([\w-]{11})/);
    return m ? m[1] : null;
  }

  // YouTube start time from the URL: t=90, t=90s, t=1m30s, t=1h2m3s
  function urlStartTime() {
    const u = new URL(location.href);
    const t = u.searchParams.get('t') || u.searchParams.get('start')
      || (u.hash.match(/[#&]t=([^&]+)/) || [])[1];
    if (!t) return 0;
    if (/^\d+s?$/.test(t)) return parseInt(t, 10);
    const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    return m ? (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0)) : 0;
  }

  // Video id the player has actually loaded (Firefox lets content scripts call
  // the page's player API through wrappedJSObject). Falls back to the URL.
  function playerVideoId(player) {
    try {
      const data = player.wrappedJSObject.getVideoData();
      if (data && data.video_id) return String(data.video_id);
    } catch (e) { /* API not available */ }
    return null;
  }

  // Returns { id, player } if `video` is the main player playing real content
  // of the video in the URL; null for previews, ads, shorts, other pages.
  function context(video) {
    if (!(video instanceof HTMLVideoElement)) return null;
    const player = video.closest('#movie_player');
    if (!player || video.closest(PREVIEW_CONTAINERS)) return null;
    if (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting')) return null;
    const urlId = urlVideoId();
    if (!urlId) return null;
    const id = playerVideoId(player) || urlId;
    if (id !== urlId) return null; // player still on the previous video, or a preview
    return { id, player };
  }

  // ---------- save / resume ----------

  function save(force) {
    if (!current || !current.ready) return;
    const { id, video } = current;
    const now = Date.now();
    if (!force && now - current.lastSave < SAVE_EVERY_MS) return;
    const ctx = context(video);
    if (!ctx || ctx.id !== id) return;
    const t = video.currentTime;
    const d = video.duration;
    if (!Number.isFinite(d) || d < MIN_DURATION) return; // live streams, short clips
    current.lastSave = now;
    if (d - t <= END_MARGIN || t < MIN_POSITION) {
      store.remove(key(id));
    } else {
      store.set({ [key(id)]: { t: Math.floor(t), d: Math.floor(d), at: now } });
    }
  }

  async function startTracking(video, id) {
    const entry = { id, video, ready: false, lastSave: 0 };
    current = entry;
    let saved;
    try {
      saved = (await store.get(key(id)))[key(id)];
    } catch (e) { /* storage error: just track from here */ }
    if (current !== entry) return; // navigated away meanwhile
    if (saved && Number.isFinite(video.duration)) {
      // Resume if the saved spot is later than where YouTube starts us
      // (start of video, a &t= from a hover preview, or YouTube's own resume).
      const startAt = Math.max(video.currentTime, urlStartTime());
      if (saved.t > startAt + 3 && saved.t < video.duration - END_MARGIN) {
        video.currentTime = saved.t;
      }
    }
    entry.ready = true;
  }

  // ---------- events (capture phase: media events don't bubble) ----------

  // Start tracking on 'playing', or on 'timeupdate' when playback was already
  // running without a fresh 'playing' (e.g. carried over from a hover preview).
  function maybeStart(video) {
    if (current && current.video === video) return false;
    const ctx = context(video);
    if (!ctx) return false;
    startTracking(video, ctx.id);
    return true;
  }

  document.addEventListener('playing', (e) => {
    const ctx = context(e.target);
    if (ctx && !(current && current.id === ctx.id && current.video === e.target)) {
      startTracking(e.target, ctx.id);
    }
  }, true);

  document.addEventListener('timeupdate', (e) => {
    if (current && e.target === current.video) save(false);
    else maybeStart(e.target);
  }, true);

  for (const type of ['pause', 'seeked']) {
    document.addEventListener(type, (e) => {
      if (current && e.target === current.video) save(true);
    }, true);
  }

  document.addEventListener('ended', (e) => {
    if (current && e.target === current.video && context(e.target)) {
      store.remove(key(current.id));
      current = null;
    }
  }, true);

  // New source in the tracked element (next video, ad, ...): stop tracking;
  // the next 'playing' of real content starts again.
  document.addEventListener('loadstart', (e) => {
    if (current && e.target === current.video) current = null;
  }, true);

  // YouTube in-app navigation: save before the player switches videos.
  window.addEventListener('yt-navigate-start', () => {
    save(true);
    current = null;
  }, true);

  window.addEventListener('pagehide', () => save(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save(true);
  });

  // ---------- housekeeping: forget old entries, at most once a day ----------

  (async () => {
    try {
      const { 'meta:lastCleanup': last = 0 } = await store.get('meta:lastCleanup');
      const now = Date.now();
      if (now - last < 24 * 3600 * 1000) return;
      const all = await store.get(null);
      const cutoff = now - FORGET_AFTER_DAYS * 24 * 3600 * 1000;
      const old = Object.keys(all).filter((k) => k.startsWith('v:') && !(all[k].at > cutoff));
      if (old.length) await store.remove(old);
      await store.set({ 'meta:lastCleanup': now });
    } catch (e) { /* not critical */ }
  })();
})();
