# The Ocean's Green Pulse — DSC 106 Project 3

**Question:** *When does the ocean bloom, and why does each region bloom at a different time of year?*

Dataset: **NASA MODIS (Aqua) via GIBS**. Layer `MODIS_Aqua_L2_Chlorophyll_A` (daily ocean-color
chlorophyll-a, a proxy for phytoplankton), 2003–2022.

## Data pipeline (`main.py`)

GIBS serves colored images, not numbers. `main.py` downloads one global 720×360 (0.5°) image per day
through the GIBS WMS API. It turns each pixel's color back into chlorophyll (mg/m³) using GIBS's published
colormap (`MODIS_Chlorophyll.xml`: 255 log-spaced bins, 0.01–20 mg/m³), then averages the images into
monthly composites and a 12-month climatology.

```bash
python3 main.py fetch          # one image per day (~7,300), ~20 min, resumable (cached in data_raw/)
python3 main.py build          # climatology -> data/chl_clim.bin.gz, data/meta.json, exploration/aggregates.json

# exploratory graphs (needs matplotlib)
python3 -m venv .venv && .venv/bin/pip install numpy pillow matplotlib
.venv/bin/python main.py explore   # -> exploration/*.png
```

Transformations:
- Every average is taken in log space (a geometric mean), because chlorophyll is roughly log-normal.
- Missing pixels (cloud, sea ice, land, polar night, gaps between passes) are ignored.
- A climatology cell needs data from ≥ 3 years and ≥ 20 daily observations in that calendar month.
- A latitude is dropped for a month when the sun is less than 18° above the horizon at Aqua's 13:30 overpass
  (solar zenith angle > 72°).
  Below that sun angle, readings show a spurious winter "bloom" in both hemispheres.
- Years: 2003–2022. Aqua's orbit has been drifting to later overpasses since about 2022, and 2024 shows a clear
  low-sun artifact, so 2023–2024 are downloaded but left out.
- Region and latitude averages weight cells by cos(latitude).

## Files

| Path | What |
|---|---|
| `main.py` | data pipeline (fetch → build → explore) |
| `data/chl_clim.bin.gz` | 12 × 360 × 720 uint8 climatology (0 = no data; 1–255 = log10 chl), gzip |
| `data/meta.json` | grid, encoding and region definitions |
| `data/land-50m.json` | Natural Earth land outlines (world-atlas TopoJSON) |
| `exploration/*.png` | static exploratory graphs for the checkpoint |
