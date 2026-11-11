#!/bin/sh
# Package the add-on for addons.mozilla.org: only the files the extension needs.
set -e
cd "$(dirname "$0")"
version=$(python3 -I -c 'import json; print(json.load(open("manifest.json"))["version"])')
out="dist/resume-playback-for-youtube-$version.zip"
mkdir -p dist
rm -f "$out"
zip -q -X "$out" manifest.json resume.js cleanup.js options.html options.js icon.svg LICENSE
echo "$out"
