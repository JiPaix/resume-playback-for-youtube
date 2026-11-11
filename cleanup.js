'use strict';
// Shared by the content script and the options page.

// How long saved positions are kept, chosen on the options page.
const RETENTION_KEY = 'meta:retentionDays';
const RETENTION_DEFAULT_DAYS = 15;
const RETENTION_CHOICES = [7, 15, 30, 60, 90];

async function getRetentionDays() {
  const { [RETENTION_KEY]: days } = await browser.storage.local.get(RETENTION_KEY);
  return RETENTION_CHOICES.includes(days) ? days : RETENTION_DEFAULT_DAYS;
}

// Forget positions not updated within the retention period.
// With force=false it runs at most once a day.
async function cleanupOldPositions(force = false) {
  const store = browser.storage.local;
  const now = Date.now();
  if (!force) {
    const { 'meta:lastCleanup': last = 0 } = await store.get('meta:lastCleanup');
    if (now - last < 24 * 3600 * 1000) return;
  }
  const cutoff = now - (await getRetentionDays()) * 24 * 3600 * 1000;
  const all = await store.get(null);
  const old = Object.keys(all).filter((k) => k.startsWith('dbg:')
    || (k.startsWith('v:') && !(all[k].at > cutoff)));
  if (old.length) await store.remove(old);
  await store.set({ 'meta:lastCleanup': now });
}
