import * as d3 from "d3";

// Same palettes as the matplotlib exploration graphs in main.py.
export const CHL_RAMP = ["#0d2150", "#123f86", "#13689f", "#1b8f9c", "#36ad7f", "#86cc5a", "#dcec7a"];
export const ANOM_RAMP = ["#7a4a1c", "#b9844a", "#e6cfa6", "#f2f1ec", "#a9dccb", "#3c9c86", "#0f5a4c"];
export const REGION_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const NODATA = "#e9e8e3";
export const LAND_FILL = "#bdbcb5";
export const LAND_STROKE = "#8f8e88";
export const INK = "#3b3a37";
export const MUTED = "#6b6a65";
export const GRID = "#e1e0d9";

/** Piecewise-linear ramp over evenly spaced stops; t in [0, 1] -> css color. */
function ramp(stops) {
  return d3.scaleLinear()
    .domain(stops.map((_, i) => i / (stops.length - 1)))
    .range(stops)
    .interpolate(d3.interpolateRgb)
    .clamp(true);
}
export const chlRamp = ramp(CHL_RAMP);
export const anomRamp = ramp(ANOM_RAMP);

/** Log position of a chlorophyll value (mg/m^3) between lo and hi, in [0, 1]. */
export const logT = (chl, lo, hi) => (Math.log10(chl) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo));

/**
 * Cyclic hue wheel at constant lightness (CIE LCh), as lch_wheel() in main.py.
 * t in [0, 1) is the position on the wheel; strength in [0, 1] scales chroma.
 */
export function wheel(t, strength = 1) {
  const c = d3.hcl(360 * t, 48 * strength, 62).rgb();
  return d3.rgb(clamp255(c.r), clamp255(c.g), clamp255(c.b)).formatHex();
}
const clamp255 = (v) => Math.max(0, Math.min(255, v));

/** Precompute n colors of fn(t), t in [0, 1], as RGB bytes for fast raster painting. */
export function lut(fn, n = 512) {
  const out = new Uint8Array(n * 3);
  for (let i = 0; i < n; i++) {
    const c = d3.rgb(fn(i / (n - 1)));
    out.set([c.r, c.g, c.b], i * 3);
  }
  return { table: out, n };
}

export const fmtChl = (v) => (v >= 1 ? d3.format(".2~f")(v) : d3.format(".2~r")(v));
export const fmtLat = (v) => `${Math.abs(v).toFixed(1)}°${v < 0 ? "S" : v > 0 ? "N" : ""}`;
export const fmtLon = (v) => `${Math.abs(v).toFixed(1)}°${v < 0 ? "W" : v > 0 ? "E" : ""}`;
