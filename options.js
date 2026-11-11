'use strict';

const select = document.getElementById('retention');

getRetentionDays().then((days) => { select.value = String(days); });

select.addEventListener('change', async () => {
  await browser.storage.local.set({ [RETENTION_KEY]: Number(select.value) });
  await cleanupOldPositions(true); // apply a shorter period right away
});
