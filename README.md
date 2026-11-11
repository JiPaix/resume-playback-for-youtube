<p align="center"><img src="icon.svg" width="96" alt=""></p>

<h1 align="center">Resume Playback for YouTube</h1>

<p align="center"><b>YouTube videos pick up where you left off,<br>even when you click a thumbnail after its preview.</b></p>

<p align="center">
  <a href="https://addons.mozilla.org/firefox/addon/resume-playback-for-youtube/"><img src="https://blog.mozilla.org/addons/files/2020/04/get-the-addon-fx-apr-2020.svg" alt="Get the add-on for Firefox" height="58"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Firefox-142%2B-FF7139?logo=firefoxbrowser&logoColor=white" alt="Firefox 142+">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0-blue" alt="License: GPL-3.0"></a>
</p>

<br>

### Keeps playing from the preview

Ever hovered over a YouTube thumbnail, watched the preview for a bit, clicked
it… and the video started over from the beginning? With this add-on, it keeps
playing from where the preview was. (Chrome already does this. Firefox doesn't.)

<p align="center"><img src="docs/demo-preview.gif" alt="Hovering a thumbnail, clicking it, and the video continuing from the preview position" width="720"></p>

### Picks up where you stopped

Stopped a video halfway? Open it again later, and it picks up right where you
left off.

<p align="center"><img src="docs/demo-resume.gif" alt="Closing a video halfway, reopening it, and playback resuming at the same spot" width="720"></p>

### One setting

You choose how long it remembers your videos: 15 days by default. Click the
add-on's button in the extensions menu to change it.

<p align="center"><img src="docs/options.png" alt="Settings: forget a video's position after 15 days without watching it" width="560"></p>

## Details

- **Firefox vs Chrome.** Checked in November 2026 with the same Google account
  and the same add-ons in both browsers: after a 6–8 second preview, Chrome
  opened the video at the preview's position every time; Zen (Firefox engine)
  started at 0:00 every time, unless the preview's seek bar had been dragged.
  If YouTube fixes this on Firefox one day, the add-on simply has nothing to do
  there.
- **Where you stopped:** YouTube only remembers it when you're signed in with
  watch history on. This add-on remembers it either way.
- **Left alone:** links with a timestamp (`&t=…`), ads, live streams, Shorts and
  videos shorter than a minute. A video watched to the end is forgotten, so it
  starts fresh next time. Also works in YouTube videos embedded on other sites.
- **Privacy:** the only permission is `storage`. For each video it keeps the
  video ID, the position and the date, in your browser. Nothing is sent
  anywhere: no analytics, no account, no remote code.

## How it works

A single content script, no background page and no timers polling the page.
It listens to the media events of YouTube's main player (`#movie_player`):

- Saves the position every 5 seconds while playing, and on pause, seek,
  leaving the page or switching tabs.
- Reads the loaded video's ID from the player itself (`getVideoData()`), so
  YouTube's in-page navigation can't mix up two videos.
- Remembers the position of the hover-preview player (`#inline-preview-player`)
  and applies it if you open that video within 15 seconds.
- Skips anything while an ad is showing.

Tuning constants are at the top of `resume.js`. Set `DEBUG = true` to log what
happens as `[VR]` console lines (and as `dbg:` entries in the add-on's storage).

## Development

Load it without packaging: `about:debugging#/runtime/this-firefox` →
*Load Temporary Add-on…* → pick `manifest.json`. It stays until the browser
restarts.

Build the upload package: `./build.sh` → `dist/resume-playback-for-youtube-<version>.zip`.

Release: bump `version` in `manifest.json`, commit, then push a tag `v<version>`.
The `release` workflow lints, submits the version to addons.mozilla.org (listed),
syncs the listing's text, tags, icon and screenshots (`tools/amo-listing.mjs`),
and creates a GitHub release. The store listing text, category and license live
in `docs/amo-metadata.json`. It needs
the repository secrets `AMO_JWT_ISSUER` and `AMO_JWT_SECRET` (AMO API key and secret).

Re-record the demo GIFs: `tools/capture-demo.mjs` drives a headless Firefox over
WebDriver BiDi (instructions at the top of the file), using Blender Foundation open
movies (CC BY). Frames go to `docs/raw/` (ignored by git); GIF conversion:

```sh
ffmpeg -f concat -safe 0 -i docs/raw/preview/frames.txt \
  -vf "fps=8,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
  -loop 0 docs/demo-preview.gif
```

## License

[GPL-3.0](LICENSE)
