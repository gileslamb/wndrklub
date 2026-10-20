# WndrKlub. (series pitch)

Draft TV-series pitch version of the [WndrKlub](https://wndrklub.org) site: an animated mixed-media series for 3 to 7 year olds. Made in Glasgow by [Curious Dreamers](https://curiousdreamers.com).

Not for search engines: the page carries `noindex, nofollow` and `vercel.json` sends a matching `X-Robots-Tag` header.

## Local development

A single static HTML file. Open `index.html` in a browser, or:

```bash
python3 -m http.server 8000
```

## Deployment

Vercel project `wndrklub` (wndrklub.com / .org), from `main` of gileslamb/wndrklub; other branches build previews.

## Structure

- `index.html`: the page
- `img/`: Sacha's artwork (Wndr(er) figure, lemon flipbook frames, episode worlds) and Dixie's pose sheets in `img/dixie/`
- `media.json`: where the hosted media lives. Music on R2 (`museum-playlist` bucket), test films on Cloudflare Stream. Shared with the main WndrKlub site, nothing re-uploaded.
- `vercel.json`: deployment config and the noindex header

## Gate

`middleware.js` (Vercel Routing Middleware) serves a cream page with the lemon and a password field until the visitor has the session cookie. The password is the `SITE_PASSWORD` environment variable on the Vercel project, never in the repo or the page. With no `SITE_PASSWORD` the site fails closed. Once in, the page shows the lemon again: tapping it turns sound on (that tap is what unlocks Web Audio) and opens the site; "enter without sound" goes in quietly.

## Sound

- One switch, in the music player pill, is the master for the whole page: off means no sound effects and no music, and nothing is fetched. Pressing play on the music turns it on. The choice lasts for the browser session.
- The hero's effects are triggered by the animation's events (cube bounces and landings, the splat, the stray cube's landing, the impact, the roll and the settle) and played through Web Audio: random variant without repeats, small random pitch and gain, panned to where it happens, at most 8 at once. The lemon's roll is a loop that follows its speed.
- Files and `manifest.json` live in the R2 bucket `wndrklub-sfx`, public at https://pub-5e50c80530864ad79bca1353ddf95e71.r2.dev/manifest.json. The page reads the manifest, so a sound can be replaced or added by uploading a file and editing the manifest: `{ "events": { "cube-land": { "files": [...], "gain": 0.8, "pitch": 2, "loop": false } } }`. Audio is cached for a year, so give a replaced sound a new file name.
- A small room reverb is added in the page (a generated impulse response on a send, nothing to load). Its level is the manifest's top-level `"reverb"` (default 0.22).
- Going in with sound starts the first music track, faded up over 2.5 s. "again", under the credit line, replays the hero with a fresh draw.
- `scripts/generate-sfx.js` makes the set with the ElevenLabs Sound Effects API (key in a local, git-ignored `.env` as `ELEVENLABS_API_KEY`), trims the silence before each hit and evens out loudness with ffmpeg. `scripts/upload-sfx.sh` uploads them with wrangler.

## Image credits

- `img/faces/goldfish.webp` (+ `@2x`): cut from the WndrKlub bible, page 11.
- `img/faces/cheese.webp` (+ `@2x`): cut from Giles's cheese still.
- `img/faces/lemon.webp` (+ `@2x`): the site's lemon artwork, cropped.
