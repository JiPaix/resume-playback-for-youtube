# addons.mozilla.org listing text

Paste into the listing fields on the AMO developer hub.

## Summary (max 250 characters)

On Firefox, YouTube restarts a video at 0:00 when you click it after a hover preview; Chrome continues from the preview. This fixes that, and resumes any video where you left off, even signed out. No data leaves your browser.

## Description (AMO allows basic HTML)

<b>Two YouTube annoyances, fixed:</b>
<ul>
<li><b>On Firefox, clicking a video you were previewing restarts it at 0:00.</b> In Chrome, when you hover a thumbnail, let the preview play and click it, the full video continues from the preview. In Firefox and Firefox-based browsers YouTube throws that position away, even when you're signed in. This add-on remembers the preview's position and continues from there, like Chrome.</li>
<li><b>You close a video halfway and it starts over next time.</b> YouTube only remembers your position when you're signed in with watch history on. This add-on remembers it in your browser, signed in or not.</li>
</ul>

<b>It stays out of your way</b>
<ul>
<li>Timestamp links (&amp;t=…) are respected: your saved position is only used when a video would start from the beginning.</li>
<li>Ads, live streams, Shorts and videos under a minute are ignored.</li>
<li>Finished videos are forgotten, so they start fresh next time.</li>
<li>Works in YouTube videos embedded on other sites too.</li>
</ul>

<b>One setting</b>
How long a position is kept if you don't come back to the video: 7, 15 (default), 30, 60 or 90 days. Click the add-on's button in the extensions menu to change it.

<b>Privacy</b>
Only the "storage" permission. It saves the video ID, the position and the date, in your browser only. Nothing is sent anywhere: no analytics, no account, no remote code.

<b>Lightweight</b>
No background page and no timers: it only listens to the video player's own events, and saves every few seconds while you watch.

Source code (GPL-3.0): https://github.com/JiPaix/resume-playback-for-youtube

## Screenshots (upload in this order, 1280×800)

1. `docs/screenshots/1-hover-preview.png`: "Hover a thumbnail: YouTube plays a preview."
2. `docs/screenshots/2-continues-from-preview.png`: "Click it: the full video continues from the preview instead of restarting at 0:00."
3. `docs/screenshots/3-resumes-where-you-left-off.png`: "Close a video, open it again later: it continues where you left off."

## Other fields

- Categories: Photos, Music & Videos
- Support site: https://github.com/JiPaix/resume-playback-for-youtube/issues
- License: GNU General Public License v3.0
- Privacy policy: not needed (no data collected); the manifest declares `data_collection_permissions: none`.
