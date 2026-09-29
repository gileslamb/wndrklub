# WndrKlub.

Web home of [WndrKlub](https://wndrklub.org), a curious series of short films inspiring young people to tell stories full of wonder. Made in Glasgow by [Curious Dreamers](https://curiousdreamers.com).

## Local development

It's a single static HTML file. Open `index.html` in a browser, or:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deployment

Deploys automatically to Vercel on push to `main`.

## Structure

- `index.html` — the site
- `music.html` — standalone music page for the animator test
- `api/track.js` — edge proxy for track downloads
- `img/` — Sacha's artwork (Wndr(er) figure, lemon flipbook frames, episode worlds, Dixie pose sheets in `img/dixie/`)
- `media.json` — where the hosted media lives: music on R2 (`museum-playlist` bucket), test films on Cloudflare Stream
- `vercel.json` — deployment config

Source media (mp3, mp4, pdf) is kept out of git; see `.gitignore`.

## Roadmap

- **Phase 1 — Berlin (May 2026):** scrollable site, character art, sample episode worlds, one animated flipbook
- **Phase 2 — Annecy (June 2026):** full sample episode, season concepts, classroom layer
- **Phase 3 — Platform (late 2026+):** distribution, institutional licensing, teacher resources
