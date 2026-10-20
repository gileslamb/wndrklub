# WndrKlub. (series pitch)

Draft TV-series pitch version of the [WndrKlub](https://wndrklub.org) site: an animated mixed-media series for 3 to 7 year olds. Made in Glasgow by [Curious Dreamers](https://curiousdreamers.com).

Not for search engines: the page carries `noindex, nofollow` and `vercel.json` sends a matching `X-Robots-Tag` header.

## Local development

A single static HTML file. Open `index.html` in a browser, or:

```bash
python3 -m http.server 8000
```

## Deployment

Vercel project `wndrklub-series`, deploys on push to `main`.

## Structure

- `index.html`: the page
- `img/`: Sacha's artwork (Wndr(er) figure, lemon flipbook frames, episode worlds) and Dixie's pose sheets in `img/dixie/`
- `media.json`: where the hosted media lives. Music on R2 (`museum-playlist` bucket), test films on Cloudflare Stream. Shared with the main WndrKlub site, nothing re-uploaded.
- `vercel.json`: deployment config and the noindex header

## Image credits

- `img/faces/goldfish.webp` (+ `@2x`): cut from the WndrKlub bible, page 11.
- `img/faces/cloud.webp` (+ `@2x`): cut from [Cumulus mediocris Rivergate Marina Murarrie P1170631.jpg](https://commons.wikimedia.org/wiki/File:Cumulus_mediocris_Rivergate_Marina_Murarrie_P1170631.jpg) by John Robert McPherson, Wikimedia Commons, [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (public domain dedication).
