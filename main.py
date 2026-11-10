"""
Data pipeline for "The Ocean's Green Pulse" (DSC 106, Project 3).

Source: NASA GIBS (Global Imagery Browse Services), layer
    MODIS_Aqua_L2_Chlorophyll_A   (daily, MODIS on the Aqua satellite)

GIBS serves *images*, not numbers: each pixel is one of 255 colours, and the
published colormap (MODIS_Chlorophyll.xml) says which chlorophyll range each
colour stands for. This script:

  1. fetch  - downloads one global 720x360 (0.5 degree) PNG per day through
              the GIBS WMS endpoint, turns every pixel's colour back into a
              chlorophyll-a value (mg/m^3) using the colormap, and averages
              the valid (cloud-free, ice-free) pixels of each calendar month
              into a monthly composite.  Averages are taken in log10 space
              (i.e. geometric means), because chlorophyll is log-normally
              distributed.  One small .npz per year-month is cached in
              data_raw/ so the download can be resumed.

  2. build  - averages the monthly composites across years into a 12-month
              climatology (mean of the yearly monthly means, at least
              MIN_YEARS years required per cell), quantises log10(chl) to
              one byte per cell and writes the files the website loads:
                  data/chl_clim.bin.gz   12 x 360 x 720 uint8, gzip
                  data/meta.json         grid + quantisation parameters
              It also writes exploration/aggregates.json (year-by-year
              regional time series) used for the checkpoint graphs.

  3. explore - draws the static exploratory graphs for the checkpoint into
              exploration/*.png (needs matplotlib; see README).

Usage
    python3 main.py fetch [--start 2003-01] [--end 2022-12] [--workers 8]
    python3 main.py build
    .venv/bin/python main.py explore
    python3 main.py all          (fetch + build)
"""

from __future__ import annotations

import argparse
import calendar
import gzip
import io
import json
import math
import re
import sys
import time
import urllib.request
import warnings
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
RAW_DIR = ROOT / "data_raw" / "monthly"
OUT_DIR = ROOT / "data"
EXPLORE_DIR = ROOT / "exploration"

LAYER = "MODIS_Aqua_L2_Chlorophyll_A"
COLORMAP_URL = "https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_Chlorophyll.xml"
WMS_URL = (
    "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?"
    "SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS={layer}&STYLES="
    "&CRS=EPSG:4326&BBOX=-90,-180,90,180&WIDTH={w}&HEIGHT={h}"
    "&FORMAT=image/png&TIME={day}"
)
USER_AGENT = "dsc106-project3-data-pipeline/1.0"

W, H = 720, 360          # 0.5 degree global grid, row 0 = 90N..89.5N, col 0 = 180W..179.5W
CELL = 0.5
LOG_MIN = -2.0           # log10(0.01 mg/m^3): lowest colormap bin
LOG_MAX = math.log10(20) # log10(20 mg/m^3):  highest colormap bin
MIN_YEARS = 3            # a climatology cell needs data from at least this many years
MIN_SAMPLES = 20         # ...and at least this many daily observations in total (all years)
MAX_SOLAR_ZENITH = 72.0  # degrees; with the sun lower than this at Aqua's 13:30 overpass,
                         # retrievals are biased high (a fake winter "bloom" near the poles)
OVERPASS_HOUR_ANGLE = 22.5  # 13:30 local solar time = 1.5 h after noon = 22.5 degrees
# Aqua's orbit has been drifting to later overpass times since ~2022 (lower sun);
# 2024 shows a clear winter artifact, so analysis uses the stable-orbit years only.
CLIM_YEARS = (2003, 2022)


# --------------------------------------------------------------------------
# Colormap inversion
# --------------------------------------------------------------------------
def http_get(url: str, retries: int = 5, timeout: int = 60) -> bytes:
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:  # network hiccup / 5xx: back off and retry
            last = e
            time.sleep(1.5 * 2 ** attempt)
    raise RuntimeError(f"GET failed after {retries} tries: {url}\n{last}")


def load_colormap() -> tuple[np.ndarray, np.ndarray]:
    """Return (sorted packed RGB keys, log10 chlorophyll for each key).

    Each colormap entry covers a value interval such as "[0.0100,0.0103)".
    We represent a bin by the midpoint of its interval in log space.
    """
    xml = http_get(COLORMAP_URL).decode("utf-8")
    entries = re.findall(r"<ColorMapEntry\s+([^>]*)/>", xml)
    keys, logs = [], []
    for attrs in entries:
        a = dict(re.findall(r'(\w+)="([^"]*)"', attrs))
        if a.get("nodata") == "true":
            continue
        r, g, b = (int(v) for v in a["rgb"].split(","))
        lo_s, hi_s = re.match(r"[\[(]([^,]*),([^)\]]*)[)\]]", a["value"]).groups()
        lo = None if "INF" in lo_s else float(lo_s)
        hi = None if "INF" in hi_s else float(hi_s)
        if lo is None:                       # (-INF, 0.01)
            lv = math.log10(hi)
        elif hi is None:                     # [20, +INF)
            lv = math.log10(lo)
        else:
            lv = (math.log10(lo) + math.log10(hi)) / 2
        keys.append((r << 16) | (g << 8) | b)
        logs.append(lv)
    keys = np.array(keys, dtype=np.int64)
    logs = np.array(logs, dtype=np.float32)
    order = np.argsort(keys)
    if len(np.unique(keys)) != len(keys):
        raise ValueError("colormap colours are not unique; cannot invert")
    return keys[order], logs[order]


def decode_png(png: bytes, keys: np.ndarray, logs: np.ndarray) -> np.ndarray:
    """PNG bytes -> (H, W) float32 array of log10(chl), NaN where no data."""
    a = np.asarray(Image.open(io.BytesIO(png)).convert("RGBA"))
    if a.shape[:2] != (H, W):
        raise ValueError(f"unexpected image size {a.shape}")
    packed = (a[..., 0].astype(np.int64) << 16) | (a[..., 1].astype(np.int64) << 8) | a[..., 2]
    idx = np.clip(np.searchsorted(keys, packed), 0, len(keys) - 1)
    ok = (a[..., 3] == 255) & (keys[idx] == packed)
    out = np.full((H, W), np.nan, dtype=np.float32)
    out[ok] = logs[idx[ok]]
    return out


# --------------------------------------------------------------------------
# Stage 1: fetch daily images -> monthly composites
# --------------------------------------------------------------------------
def month_range(start: str, end: str):
    y, m = map(int, start.split("-"))
    ey, em = map(int, end.split("-"))
    while (y, m) <= (ey, em):
        yield y, m
        m += 1
        if m == 13:
            y, m = y + 1, 1


def fetch_month(y: int, m: int, keys, logs, pool: ThreadPoolExecutor) -> str:
    out = RAW_DIR / f"{y:04d}-{m:02d}.npz"
    if out.exists():
        return f"{y}-{m:02d} cached"
    days = [date(y, m, d) for d in range(1, calendar.monthrange(y, m)[1] + 1)]

    def one(day):
        try:
            png = http_get(WMS_URL.format(layer=LAYER, w=W, h=H, day=day.isoformat()))
            return decode_png(png, keys, logs)
        except Exception as e:
            print(f"   ! {day}: {e}", file=sys.stderr)
            return None

    total = np.zeros((H, W), dtype=np.float64)
    count = np.zeros((H, W), dtype=np.uint16)
    failed = 0
    for arr in pool.map(one, days):
        if arr is None:
            failed += 1
            continue
        ok = ~np.isnan(arr)
        total[ok] += arr[ok]
        count[ok] += 1
    if failed > 2:
        return f"{y}-{m:02d} NOT saved ({failed} days failed) - rerun fetch to retry"
    mean = np.full((H, W), np.nan, dtype=np.float32)
    has = count > 0
    mean[has] = (total[has] / count[has]).astype(np.float32)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(out, mean_log=mean, count=count,
                        days=len(days), failed=failed)
    return f"{y}-{m:02d} ok  days={len(days)-failed}/{len(days)}  coverage={has.mean():.3f}"


def fetch(start: str, end: str, workers: int):
    keys, logs = load_colormap()
    print(f"colormap: {len(keys)} colours, log10 range {logs.min():.3f}..{logs.max():.3f}")
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for y, m in month_range(start, end):
            print(fetch_month(y, m, keys, logs, pool), f"[{time.time()-t0:.0f}s]", flush=True)


# --------------------------------------------------------------------------
# Stage 2: build climatology + site data files
# --------------------------------------------------------------------------
LATS = 90 - CELL / 2 - CELL * np.arange(H)          # cell-centre latitudes
LONS = -180 + CELL / 2 + CELL * np.arange(W)        # cell-centre longitudes
WEIGHT = np.cos(np.deg2rad(LATS))[:, None] * np.ones((1, W))  # area weight

# Regions used for the guided "stories" on the site and for exploration.
REGIONS = {
    "North Atlantic":           dict(lon=(-40, -15), lat=(45, 60)),
    "Southern Ocean":           dict(lon=(-50, 0),   lat=(-60, -45)),
    "Arabian Sea":              dict(lon=(55, 70),   lat=(10, 22)),
    "Equatorial Pacific":       dict(lon=(-140, -100), lat=(-3, 3)),
    "North Pacific Gyre":       dict(lon=(-160, -140), lat=(18, 28)),
}


def region_mask(lon, lat) -> np.ndarray:
    lo = (LONS >= lon[0]) & (LONS < lon[1])
    la = (LATS >= lat[0]) & (LATS < lat[1])
    return la[:, None] & lo[None, :]


def weighted_logmean(arr: np.ndarray, mask: np.ndarray | None = None):
    ok = ~np.isnan(arr)
    if mask is not None:
        ok &= mask
    if not ok.any():
        return None
    return float(np.sum(arr[ok] * WEIGHT[ok]) / np.sum(WEIGHT[ok]))


def overpass_zenith(month: int) -> np.ndarray:
    """Solar zenith angle (deg) at 13:30 local time on the 15th of `month` (1-12), per grid row."""
    doy = date(2001, month, 15).timetuple().tm_yday
    dec = np.deg2rad(23.44 * np.sin(np.deg2rad(360 / 365 * (doy - 81))))
    lat = np.deg2rad(LATS)
    cosz = np.sin(lat) * np.sin(dec) + np.cos(lat) * np.cos(dec) * np.cos(np.deg2rad(OVERPASS_HOUR_ANGLE))
    return np.rad2deg(np.arccos(np.clip(cosz, -1, 1)))


def build():
    files = [f for f in sorted(RAW_DIR.glob("*.npz"))
             if CLIM_YEARS[0] <= int(f.stem[:4]) <= CLIM_YEARS[1]]
    if not files:
        sys.exit("no monthly composites in data_raw/monthly - run `python3 main.py fetch` first")
    by_month: dict[int, list[np.ndarray]] = {m: [] for m in range(1, 13)}
    samples = np.zeros((12, H, W), dtype=np.int32)   # total daily observations per calendar month
    series = []  # per year-month aggregates for exploration
    years = set()
    for f in files:
        y, m = map(int, f.stem.split("-"))
        years.add(y)
        d = np.load(f)
        mean = d["mean_log"]
        by_month[m].append(mean)
        samples[m - 1] += d["count"]
        mean = mean.copy()                           # same low-sun mask for the yearly series
        mean[overpass_zenith(m) > MAX_SOLAR_ZENITH, :] = np.nan
        row = {"year": y, "month": m, "coverage": float((~np.isnan(mean)).mean())}
        row["global"] = weighted_logmean(mean)
        row["north"] = weighted_logmean(mean, LATS[:, None] > 0)
        row["south"] = weighted_logmean(mean, LATS[:, None] < 0)
        for name, r in REGIONS.items():
            row[name] = weighted_logmean(mean, region_mask(**r))
        series.append(row)

    clim = np.full((12, H, W), np.nan, dtype=np.float32)
    nyears = np.zeros((12, H, W), dtype=np.uint8)
    for m in range(1, 13):
        stack = np.stack(by_month[m])                      # (years, H, W)
        n = (~np.isnan(stack)).sum(axis=0)
        with warnings.catch_warnings():          # all-NaN cells -> NaN, silently
            warnings.simplefilter("ignore", RuntimeWarning)
            mean = np.nanmean(stack, axis=0)
        # Too few observations -> unreliable. In practice this trims the edge of
        # polar darkness, where a handful of low-sun-angle retrievals read high.
        mean[(n < MIN_YEARS) | (samples[m - 1] < MIN_SAMPLES)] = np.nan
        # Low sun: zonal means show a spurious rise beyond ~73 deg in both hemispheres.
        mean[overpass_zenith(m) > MAX_SOLAR_ZENITH, :] = np.nan
        clim[m - 1] = mean
        nyears[m - 1] = n

    # quantise: 0 = no data, 1..255 = log10(chl) linearly between LOG_MIN and LOG_MAX
    q = np.zeros(clim.shape, dtype=np.uint8)
    ok = ~np.isnan(clim)
    scaled = (np.clip(clim[ok], LOG_MIN, LOG_MAX) - LOG_MIN) / (LOG_MAX - LOG_MIN)
    q[ok] = np.round(scaled * 254).astype(np.uint8) + 1

    # full-precision copy for the exploration graphs
    np.savez_compressed(RAW_DIR.parent / "climatology.npz", clim=clim, nyears=nyears, samples=samples)

    OUT_DIR.mkdir(exist_ok=True)
    with gzip.open(OUT_DIR / "chl_clim.bin.gz", "wb", compresslevel=9) as fh:
        fh.write(q.tobytes())
    meta = {
        "title": "MODIS-Aqua chlorophyll-a monthly climatology",
        "source": f"NASA GIBS layer {LAYER} (daily), colormap MODIS_Chlorophyll.xml",
        "years": [min(years), max(years)],
        "n_monthly_composites": len(files),
        "width": W, "height": H, "cell_deg": CELL,
        "lon_min": -180, "lat_max": 90,
        "layout": "month-major uint8 [12][height][width], row 0 = northernmost",
        "encoding": "0 = no data; v in 1..255 -> log10(chl) = log_min + (v-1)/254*(log_max-log_min)",
        "log_min": LOG_MIN, "log_max": LOG_MAX, "units": "mg/m^3",
        "min_years_per_cell": MIN_YEARS,
        "min_daily_samples_per_cell": MIN_SAMPLES,
        "max_solar_zenith_deg": MAX_SOLAR_ZENITH,
        "regions": REGIONS,
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
    }
    (OUT_DIR / "meta.json").write_text(json.dumps(meta, indent=2))

    # exploration aggregates (small JSON, used for checkpoint graphs)
    EXPLORE_DIR.mkdir(exist_ok=True)
    zonal = []                                   # 1-degree latitude bands, mean log10 chl
    for m in range(12):
        row = []
        for i in range(0, H, 2):
            band = clim[m, i:i + 2]
            row.append(float(np.nanmean(band)) if (~np.isnan(band)).sum() >= 10 else None)
        zonal.append(row)
    hist_counts, hist_edges = np.histogram(clim[ok], bins=60, range=(LOG_MIN, LOG_MAX))
    (EXPLORE_DIR / "aggregates.json").write_text(json.dumps({
        "series": series,
        "zonal_lat": [float(LATS[i] - CELL / 2) for i in range(0, H, 2)],
        "zonal": zonal,
        "hist_edges": hist_edges.tolist(),
        "hist_counts": hist_counts.tolist(),
        "regions": REGIONS,
    }))

    size = (OUT_DIR / "chl_clim.bin.gz").stat().st_size
    print(f"built climatology from {len(files)} monthly composites ({min(years)}-{max(years)})")
    print(f"  cells with data per month: {[int(ok[m].sum()) for m in range(12)]}")
    print(f"  data/chl_clim.bin.gz: {size/1e6:.2f} MB")
    for name, r in REGIONS.items():
        mk = region_mask(**r)
        vals = [weighted_logmean(clim[m], mk) for m in range(12)]
        txt = " ".join("  -  " if v is None else f"{10**v:5.2f}" for v in vals)
        print(f"  {name:20s} {txt}")


# --------------------------------------------------------------------------
# Stage 3: exploratory graphs (static, matplotlib) for the checkpoint
# --------------------------------------------------------------------------
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
CHL_RAMP = ["#0d2150", "#123f86", "#13689f", "#1b8f9c", "#36ad7f", "#86cc5a", "#dcec7a"]
# fixed categorical order (adjacent pairs validated for color-vision deficiency)
REGION_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"]
# NOAA Oceanic Nino Index El Nino episodes since 2003 (moderate or stronger)
EL_NINO = [(2009 + 6 / 12, 2010 + 4 / 12), (2015 + 2 / 12, 2016 + 5 / 12), (2023 + 4 / 12, 2024 + 5 / 12)]
MIN_MONTHS = 6           # months with data needed for annual mean / anomaly / peak month


def load_land(path: Path):
    """Decode the exterior rings of a world-atlas TopoJSON 'land' object."""
    tj = json.loads(path.read_text())
    (sx, sy), (tx, ty) = tj["transform"]["scale"], tj["transform"]["translate"]
    arcs = []
    for arc in tj["arcs"]:
        a = np.cumsum(np.array(arc, dtype=np.float64), axis=0)
        arcs.append(np.column_stack([a[:, 0] * sx + tx, a[:, 1] * sy + ty]))

    def ring(ids):
        parts = [arcs[i] if i >= 0 else arcs[~i][::-1] for i in ids]
        return np.vstack([parts[0]] + [p[1:] for p in parts[1:]])

    def unwrap(r):
        """Rings crossing the antimeridian (Eurasia, Fiji) jump by ~360 degrees;
        make them continuous and add a copy shifted by 360 so both halves show."""
        if np.abs(r[:, 1]).max() > 89.5:          # Antarctica: already a planar cap
            return [r]
        d = np.diff(r[:, 0])
        if np.abs(d).max() <= 180:
            return [r]
        lon = np.concatenate([[r[0, 0]], r[0, 0] + np.cumsum((d + 180) % 360 - 180)])
        r2 = np.column_stack([lon, r[:, 1]])
        return [r2, r2 + [-360 if lon.max() > 180 else 360, 0]]

    rings = []
    for g in tj["objects"]["land"]["geometries"]:
        polys = [g["arcs"]] if g["type"] == "Polygon" else g["arcs"]
        for p in polys:
            rings += unwrap(ring(p[0]))
    return rings


def lch_wheel(t: np.ndarray, strength: np.ndarray | float = 1.0, L=62.0, C=48.0) -> np.ndarray:
    """Cyclic hue wheel at constant lightness (CIE LCh -> sRGB). t in [0,1)."""
    h = 2 * np.pi * np.asarray(t)
    c = C * np.asarray(strength)
    a, b = c * np.cos(h), c * np.sin(h)
    fy = (L + 16) / 116
    fx, fz = fy + a / 500, fy - b / 200
    finv = lambda f: np.where(f ** 3 > 0.008856, f ** 3, (f - 16 / 116) / 7.787)
    X, Y, Z = 0.95047 * finv(fx), 1.0 * finv(fy), 1.08883 * finv(fz)
    rgb = np.stack([3.2406 * X - 1.5372 * Y - 0.4986 * Z,
                    -0.9689 * X + 1.8758 * Y + 0.0415 * Z,
                    0.0557 * X - 0.2040 * Y + 1.0570 * Z], axis=-1)
    rgb = np.where(rgb > 0.0031308, 1.055 * np.clip(rgb, 0, None) ** (1 / 2.4) - 0.055, 12.92 * rgb)
    return np.clip(rgb, 0, 1)


def explore():
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from matplotlib.colors import LinearSegmentedColormap, LogNorm, ListedColormap, BoundaryNorm
        from matplotlib.collections import PolyCollection
    except ImportError:
        sys.exit("explore needs matplotlib:  python3 -m venv .venv && .venv/bin/pip install numpy pillow matplotlib")

    clim_file = RAW_DIR.parent / "climatology.npz"
    agg_file = EXPLORE_DIR / "aggregates.json"
    if not clim_file.exists() or not agg_file.exists():
        sys.exit("run `python3 main.py build` first")
    clim = np.load(clim_file)["clim"]                     # (12, H, W) log10 chl, NaN = no data
    agg = json.loads(agg_file.read_text())
    land = load_land(OUT_DIR / "land-50m.json")
    years = sorted({r["year"] for r in agg["series"]})
    yr_txt = f"{years[0]}–{years[-1]}"

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        nmonths = (~np.isnan(clim)).sum(axis=0)
        annual = np.nanmean(clim, axis=0)
        annual[nmonths < MIN_MONTHS] = np.nan
        anom = clim - annual[None]                          # log10 ratio to own annual mean
        filled = np.where(np.isnan(clim), -np.inf, clim)
        peak = filled.argmax(axis=0).astype(float)
        amp = np.nanmax(clim, axis=0) - np.nanmin(clim, axis=0)
    peak[nmonths < MIN_MONTHS] = np.nan

    plt.rcParams.update({
        "font.family": "sans-serif", "font.size": 10, "axes.titlesize": 12,
        "axes.titleweight": "bold", "axes.titlelocation": "left",
        "axes.spines.top": False, "axes.spines.right": False,
        "axes.edgecolor": "#9a9890", "axes.labelcolor": "#3b3a37",
        "xtick.color": "#5f5e5a", "ytick.color": "#5f5e5a", "figure.dpi": 150,
    })
    chl_cmap = LinearSegmentedColormap.from_list("chl", CHL_RAMP)
    anom_cmap = LinearSegmentedColormap.from_list(
        "anom", ["#7a4a1c", "#b9844a", "#e6cfa6", "#f2f1ec", "#a9dccb", "#3c9c86", "#0f5a4c"])
    extent = [-180, 180, -90, 90]
    NODATA_BG = "#e9e8e3"

    def basemap(ax):
        ax.set_facecolor(NODATA_BG)
        ax.add_collection(PolyCollection(land, facecolor="#bdbcb5", edgecolor="#8f8e88", linewidth=0.3, zorder=3))
        ax.set_xlim(-180, 180); ax.set_ylim(-80, 85)
        ax.set_xticks(range(-180, 181, 60)); ax.set_yticks(range(-60, 61, 30))
        ax.set_xticklabels([f"{abs(v)}°{'W' if v < 0 else 'E' if v > 0 else ''}" for v in range(-180, 181, 60)])
        ax.set_yticklabels([f"{abs(v)}°{'S' if v < 0 else 'N' if v > 0 else ''}" for v in range(-60, 61, 30)])
        ax.tick_params(length=0, labelsize=8)
        for s in ax.spines.values():
            s.set_visible(False)

    def note(fig, text):
        fig.text(0.01, 0.01, text, fontsize=7.5, color="#6b6a65", ha="left", va="bottom")

    def log_ticks(ax, ticks, labels=None):
        """Label a log y-axis with readable values that fall inside its range."""
        lo, hi = ax.get_ylim()
        keep = [i for i, t in enumerate(ticks) if lo <= t <= hi]
        ax.set_yticks([ticks[i] for i in keep])
        ax.set_yticklabels([(labels[i] if labels else f"{ticks[i]:g}") for i in keep])
        ax.yaxis.set_minor_locator(matplotlib.ticker.NullLocator())

    CHL_TICKS = [0.02, 0.03, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5, 0.7, 1, 1.5, 2, 3, 5]

    def save(fig, name):
        out = EXPLORE_DIR / name
        fig.savefig(out, bbox_inches="tight", facecolor="white")
        plt.close(fig)
        print("  wrote", out.relative_to(ROOT))

    # 1. Where is the ocean green? annual-mean map --------------------------------
    fig, ax = plt.subplots(figsize=(10, 5.2))
    basemap(ax)
    im = ax.imshow(10 ** annual, extent=extent, origin="upper", cmap=chl_cmap,
                   norm=LogNorm(0.02, 10), interpolation="nearest", zorder=2)
    cb = fig.colorbar(im, ax=ax, orientation="horizontal", fraction=0.05, pad=0.08, aspect=40)
    cb.set_ticks([0.03, 0.1, 0.3, 1, 3, 10]); cb.set_ticklabels(["0.03", "0.1", "0.3", "1", "3", "10"])
    cb.set_label("Chlorophyll-a (mg/m³, log scale)")
    ax.set_title(f"Where is the ocean green? Annual-mean chlorophyll-a, {yr_txt}")
    note(fig, "Geometric mean of the 12 monthly climatology values; cells with < 6 months of data are left blank "
              "(light gray). Source: NASA GIBS MODIS_Aqua_L2_Chlorophyll_A, decoded from the colormap.")
    save(fig, "01_annual_mean_map.png")

    # 2. Why a log scale? distribution of values ----------------------------------
    vals = clim[~np.isnan(clim)]
    wts = np.broadcast_to(WEIGHT[None], clim.shape)[~np.isnan(clim)]
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(10, 3.6))
    a1.hist(10 ** vals, bins=80, range=(0, 5), weights=wts, color="#256abf", rwidth=0.9)
    a1.set_xlabel("Chlorophyll-a (mg/m³, linear)"); a1.set_yticks([])
    a1.set_title("Linear axis: almost all values pile up near 0")
    a2.hist(vals, bins=60, range=(LOG_MIN, LOG_MAX), weights=wts, color="#256abf", rwidth=0.9)
    a2.set_xticks(np.log10([0.01, 0.03, 0.1, 0.3, 1, 3, 10]))
    a2.set_xticklabels(["0.01", "0.03", "0.1", "0.3", "1", "3", "10"])
    a2.set_xlabel("Chlorophyll-a (mg/m³, log axis)"); a2.set_yticks([])
    a2.set_title("Log axis: roughly bell-shaped (log-normal)", fontweight="normal")
    med = 10 ** np.median(vals)
    a2.axvline(np.log10(med), color="#3b3a37", lw=1)
    a2.text(np.log10(med) + 0.05, a2.get_ylim()[1] * 0.92, f"median {med:.2f}", fontsize=8)
    note(fig, "All ocean cell-months of the climatology, weighted by cell area (cos latitude). "
              "→ we average in log space (geometric means) and use log color scales.")
    fig.tight_layout(rect=(0, 0.05, 1, 1))
    save(fig, "02_distribution_log_scale.png")

    # 3. Seasons vs. years: 22-year regional time series ---------------------------
    ser = agg["series"]
    t = np.array([r["year"] + (r["month"] - 0.5) / 12 for r in ser])
    names = ["North Atlantic", "Southern Ocean", "Equatorial Pacific"]
    region_color = dict(zip(REGIONS, REGION_COLORS))
    fig, axes = plt.subplots(len(names), 1, figsize=(10, 6.4), sharex=True)
    for ax, name in zip(axes, names):
        v = np.array([np.nan if r[name] is None else 10 ** r[name] for r in ser])
        if name == "Equatorial Pacific":
            for a, b in EL_NINO:
                if a > years[-1] + 1:
                    continue
                ax.axvspan(a, b, color="#e1e0d9", lw=0, zorder=0)
                ax.text((a + b) / 2, 0.97, "El Niño", transform=ax.get_xaxis_transform(),
                        ha="center", va="top", fontsize=7.5, color="#5f5e5a")
        ax.plot(t, v, color=region_color[name], lw=1.4)
        ax.set_yscale("log")
        ax.set_ylabel("mg/m³", fontsize=8)
        ax.text(0.005, 0.97, name, transform=ax.transAxes, fontsize=10, fontweight="bold", va="top")
        ax.grid(axis="y", color="#e1e0d9", lw=0.6); ax.set_axisbelow(True)
        log_ticks(ax, CHL_TICKS)
    axes[0].set_title(f"{yr_txt}: at high latitudes the seasons dominate; at the equator, El Niño years stand out")
    axes[-1].set_xticks(range(years[0], years[-1] + 2, 2))
    note(fig, "Monthly composites, area-weighted geometric mean over each box "
              "(N. Atlantic 45–60°N 40–15°W; Southern Ocean 45–60°S 50°W–0°; Eq. Pacific 3°S–3°N 140–100°W). "
              "Shaded: El Niño episodes (NOAA ONI). In polar winter only the box's sunlit northern edge is averaged.")
    fig.tight_layout(rect=(0, 0.04, 1, 1))
    save(fig, "03_regional_time_series.png")

    # 4. Seasonal anomaly maps: the hemispheres are out of phase ------------------
    fig, axes = plt.subplots(2, 2, figsize=(11, 6.2))
    for ax, m in zip(axes.flat, [2, 5, 8, 11]):
        basemap(ax)
        im = ax.imshow(anom[m] * math.log2(10), extent=extent, origin="upper", cmap=anom_cmap,
                       vmin=-2, vmax=2, interpolation="nearest", zorder=2)
        ax.set_title(["", "", "March", "", "", "June", "", "", "September", "", "", "December"][m], fontsize=11)
    cb = fig.colorbar(im, ax=axes, orientation="horizontal", fraction=0.04, pad=0.07, aspect=50)
    cb.set_ticks([-2, -1, 0, 1, 2]); cb.set_ticklabels(["¼×", "½×", "1× (usual)", "2×", "4×"])
    cb.set_label("Chlorophyll this month ÷ that spot's annual average")
    fig.suptitle("This month vs. the usual: the two hemispheres are six months out of phase",
                 x=0.01, ha="left", fontsize=12, fontweight="bold")
    note(fig, "Monthly climatology divided by each cell's own geometric annual mean (cells with ≥ 6 months of data). "
              "Blank = no reliable data that month (cloud, ice, or sun too low).")
    save(fig, "04_seasonal_anomaly_maps.png")

    # 5. Latitude x month (Hovmoller) ---------------------------------------------
    band_lat = np.array(agg["zonal_lat"])                  # northern edge of each 1-degree band
    bands = []
    for i in range(0, H, 4):                               # 2-degree bands
        rows = clim[:, i:i + 4, :]
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)
            n = (~np.isnan(rows)).sum(axis=(1, 2))
            z = np.nanmean(rows, axis=(1, 2))
        z[n < 20] = np.nan
        bands.append(z)
    Z = np.array(bands)                                    # (bands, 12)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        zn = (~np.isnan(Z)).sum(axis=1)
        zmean = np.nanmean(Z, axis=1)
    Zr = (Z - zmean[:, None]) * math.log2(10)
    Zr[zn < MIN_MONTHS] = np.nan
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(10, 5.4), sharey=True)
    a1.set_facecolor(NODATA_BG); a2.set_facecolor(NODATA_BG)
    ext = [-0.5, 11.5, -90, 90]
    i1 = a1.imshow(10 ** Z, aspect="auto", extent=ext, origin="upper", cmap=chl_cmap, norm=LogNorm(0.05, 2),
                   interpolation="nearest")
    i2 = a2.imshow(Zr, aspect="auto", extent=ext, origin="upper", cmap=anom_cmap, vmin=-1.5, vmax=1.5,
                   interpolation="nearest")
    for ax in (a1, a2):
        ax.set_xticks(range(12)); ax.set_xticklabels([m[0] for m in MONTHS])
        ax.set_ylim(-80, 85); ax.set_yticks(range(-60, 61, 30))
        ax.set_yticklabels([f"{abs(v)}°{'S' if v < 0 else 'N' if v > 0 else ''}" for v in range(-60, 61, 30)])
        ax.axhline(0, color="#3b3a37", lw=0.5)
        ax.tick_params(length=0)
    fig.suptitle("Average chlorophyll of each latitude band, month by month",
                 x=0.01, ha="left", fontsize=12, fontweight="bold")
    a1.set_title("Chlorophyll (mg/m³)", fontweight="normal")
    a2.set_title("Divided by each band's annual mean", fontweight="normal")
    c1 = fig.colorbar(i1, ax=a1, orientation="horizontal", pad=0.07, aspect=30)
    c1.set_ticks([0.05, 0.1, 0.2, 0.5, 1, 2]); c1.set_ticklabels(["0.05", "0.1", "0.2", "0.5", "1", "2"])
    c1.set_label("mg/m³ (log)")
    c2 = fig.colorbar(i2, ax=a2, orientation="horizontal", pad=0.07, aspect=30)
    c2.set_ticks([-1, 0, 1]); c2.set_ticklabels(["½×", "1×", "2×"])
    c2.set_label("÷ band's annual mean")
    note(fig, "2° latitude bands, geometric mean over ocean cells with data. The bloom maxima sit in spring/summer of "
              "each hemisphere and mirror each other across the equator.")
    save(fig, "05_latitude_by_month.png")

    # 6. Peak-bloom month map ------------------------------------------------------
    strength = np.clip((amp * math.log2(10) - math.log2(1.5)) / (math.log2(4) - math.log2(1.5)), 0, 1)
    rgb = lch_wheel(np.nan_to_num(peak) / 12, np.nan_to_num(strength))
    rgba = np.concatenate([rgb, (~np.isnan(peak))[..., None].astype(float)], axis=-1)
    fig = plt.figure(figsize=(10, 5.9))
    ax = fig.add_axes((0.04, 0.2, 0.92, 0.72))
    basemap(ax)
    ax.imshow(rgba, extent=extent, origin="upper", interpolation="nearest", zorder=2)
    ax.set_title("A calendar of blooms: the month when chlorophyll peaks")
    lg = fig.add_axes((0.08, 0.06, 0.5, 0.04))
    lg.imshow(lch_wheel(np.arange(12)[None] / 12), aspect="auto", extent=[-0.5, 11.5, 0, 1])
    lg.set_xticks(range(12)); lg.set_xticklabels(MONTHS, fontsize=8); lg.set_yticks([])
    lg.set_title("Peak month (cyclic: Dec wraps to Jan)", fontsize=8, fontweight="normal")
    lg2 = fig.add_axes((0.66, 0.06, 0.26, 0.04))
    lg2.imshow(lch_wheel(np.full((1, 50), 4 / 12), np.linspace(0, 1, 50)[None]), aspect="auto", extent=[0, 1, 0, 1])
    lg2.set_xticks([0, 1]); lg2.set_xticklabels(["≤1.5× swing\n(weak season)", "≥4× swing"], fontsize=7.5)
    lg2.set_yticks([])
    lg2.set_title("Color strength = seasonal range (max ÷ min)", fontsize=8, fontweight="normal")
    note(fig, "Peak = calendar month with the highest climatological chlorophyll; cells with < 6 months of data blank.")
    save(fig, "06_peak_month_map.png")

    # 7. Seasonal cycles of five contrasting regions (prototype of the linked chart)
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(10.5, 4.2))
    for (name, r), col in zip(REGIONS.items(), REGION_COLORS):
        mk = region_mask(**r)
        v = np.array([np.nan if (x := weighted_logmean(clim[m], mk)) is None else x for m in range(12)])
        a1.plot(range(12), 10 ** v, color=col, lw=2, marker="o", ms=3.5, label=name)
        a2.plot(range(12), 10 ** ((v - np.nanmean(v)) * 1.0), color=col, lw=2, marker="o", ms=3.5, label=name)
    for ax in (a1, a2):
        ax.set_yscale("log"); ax.set_xticks(range(12)); ax.set_xticklabels([m[0] for m in MONTHS])
        ax.grid(axis="y", color="#e1e0d9", lw=0.6); ax.set_axisbelow(True)
    log_ticks(a1, CHL_TICKS)
    log_ticks(a2, [0.25, 0.35, 0.5, 0.7, 1, 1.4, 2, 2.8],
              ["¼×", "0.35×", "½×", "0.7×", "1×", "1.4×", "2×", "2.8×"])
    a1.set_ylabel("Chlorophyll-a (mg/m³, log)")
    a2.set_ylabel("÷ region's annual mean")
    a2.axhline(1, color="#3b3a37", lw=0.6)
    a1.set_title("Seasonal cycle of five contrasting regions")
    a2.set_title("Same, relative to each region's own average", fontweight="normal")
    a2.legend(fontsize=8, frameon=False, loc="upper left", bbox_to_anchor=(1.0, 1.0))
    note(fig, "Monthly climatology, area-weighted geometric mean over each region box (boxes listed in data/meta.json).")
    fig.tight_layout(rect=(0, 0.05, 1, 1))
    save(fig, "07_region_seasonal_cycles.png")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("stage", choices=["fetch", "build", "explore", "all"])
    p.add_argument("--start", default="2003-01")
    p.add_argument("--end", default=f"{CLIM_YEARS[1]}-12")
    p.add_argument("--workers", type=int, default=8)
    a = p.parse_args()
    if a.stage in ("fetch", "all"):
        fetch(a.start, a.end, a.workers)
    if a.stage in ("build", "all"):
        build()
    if a.stage == "explore":
        explore()


if __name__ == "__main__":
    main()
