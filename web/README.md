# Website (React + D3)

The project site: **Project** (team + question), **Exploration** (the 7 graphs, drawn with D3)
and **Write-up**. React handles pages and layout only; every chart is drawn with D3.

```bash
cd web
npm install
npm run dev       # http://localhost:5173, live reload
npm run build     # static site in web/dist/ (what GitHub Pages serves)
npm run preview   # serve the built dist/ locally
```

## Where things are

| Path | What |
|---|---|
| `src/pages/` | `Home.jsx` (team list is the `TEAM` array), `Exploration.jsx` (graph list, titles, notes), `Writeup.jsx` |
| `src/charts/` | one D3 component per graph, plus shared `RasterMap`, `ColorBar` and `colors.js` |
| `src/data/derive.js` | decodes `chl_clim.bin.gz` and computes annual mean, peak month, histograms, latitude bands and region cycles (same math as `main.py explore`) |
| `public/data/` | copies of `../data/*` and `../exploration/aggregates.json`; re-copy after `python3 main.py build` |

Unwritten text is marked with `<Placeholder hint="..."/>` (it shows as orange "TO WRITE" blocks).
Search for `Placeholder` to find every spot that still needs real copy.

## Deploying to GitHub Pages

The build uses relative paths and a hash router (`#/exploration`), so `dist/` works from any
`https://<user>.github.io/<repo>/` URL. The simplest setup is a GitHub Actions workflow that runs
`npm ci && npm run build` in `web/` and publishes `web/dist` (Settings → Pages → Source: GitHub Actions).
