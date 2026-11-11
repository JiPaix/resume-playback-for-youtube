# Video Resumer (jipai)

Firefox/Zen extension that resumes YouTube videos where you left off.
Rewrite of the 2012 "Video Resumer" add-on, which tracked the first `<video>`
on the page (often YouTube's hover preview) and polled/saved every second.

How it works:
- One content script, no background page, no polling: capture listeners for
  the media events of YouTube's main player (`#movie_player`) only.
- The video id comes from the player itself (`getVideoData()` via
  `wrappedJSObject`), so in-app navigation can't save one video's time under another.
- Resumes at the saved position only when YouTube starts the video from the
  beginning. If it starts elsewhere (hover-preview hand-off, a timestamp link,
  YouTube's own resume), that position is kept.
- Opened from a hover preview: continues at the preview's position (the
  extension remembers it, because YouTube only sometimes hands it over).
- Hover previews (`#inline-preview-player`) and the home-page video ad
  (`#masthead-player`) are separate players and are never tracked.
- Ignores ads, live streams, Shorts, and videos shorter than 60 s.
- Saves every 5 s while playing, and on pause, seek, tab hide, navigation.
- Forgets a video when finished (last 15 s) or after 60 days unwatched.

Tuning constants are at the top of `resume.js`. Set `DEBUG = true` to record
what happens as `dbg:` storage keys and `[VR]` console lines.

## Test without signing
`about:debugging#/runtime/this-firefox` → *Load Temporary Add-on…* → pick
`manifest.json`. Stays until Zen restarts. Disable the old Video Resumer while testing.

## Install permanently
Sign as unlisted on AMO (e.g. `web-ext sign --channel=unlisted`), then install the
signed `.xpi`.
