# addons.mozilla.org listing text

Paste into the listing fields on the AMO developer hub.

## Summary (max 250 characters)

Continue YouTube videos where you left off, even signed out or with history paused. Click a video you were previewing on hover and it keeps going from the preview instead of restarting at 0:00. No data leaves your browser.

## Description (AMO allows basic HTML)

<b>Two everyday YouTube annoyances, fixed:</b>
<ul>
<li><b>You close a video halfway and it starts over next time.</b> YouTube only remembers your position when you're signed in with watch history on. This add-on remembers it in your browser, signed in or not.</li>
<li><b>You watch a hover preview, click it, and it restarts at 0:00.</b> YouTube is supposed to continue from the preview but only does it some of the time. This add-on makes it consistent.</li>
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

## Other fields

- Categories: Photos, Music & Videos
- Support site: https://github.com/JiPaix/resume-playback-for-youtube/issues
- License: GNU General Public License v3.0
- Privacy policy: not needed (no data collected); the manifest declares `data_collection_permissions: none`.
