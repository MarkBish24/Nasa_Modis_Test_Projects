// Peak-month helpers for the bloom calendar view of the main map (BloomMap).
import * as d3 from "d3";
import { H, W } from "../data/derive.js";
import { MONTHS, wheel } from "./colors.js";

// Seasonal swing (max / min of the 12 monthly values). Below WEAK the "peak
// month" means little, so the cell is plain gray; from WEAK to STRONG the
// color gets more saturated.
export const WEAK = Math.log2(1.5);
export const STRONG = Math.log2(4);
export const strengthOf = (ampLog10) => (ampLog10 * Math.log2(10) - WEAK) / (STRONG - WEAK); // < 0 = weak season

const SMOOTH_RADIUS = 2; // cells: a 5 x 5 window, about 2.5 degrees

const LEVELS = 16;
const rgb = (css) => { const c = d3.rgb(css); return [c.r, c.g, c.b]; };
// [month][level] -> rgb; chroma from 55% to 100%, so no muddy near-grays
const TABLE = MONTHS.map((_, m) => d3.range(LEVELS).map((i) => rgb(wheel(m / 12, 0.55 + (0.45 * i) / (LEVELS - 1)))));
export const WEAK_RGB = rgb(wheel(0, 0)); // neutral gray at the same lightness as the colors
export const FADED_RGB = rgb("#dcdad3"); // everything outside the focused month
export const swatch = (m) => wheel(m / 12, 1);

/** Color of a cell peaking in month m with season strength s (>= 0). */
export const peakRGB = (m, s) => TABLE[m][Math.round(Math.min(1, s) * (LEVELS - 1))];

const smoothCache = new WeakMap(); // peak array -> smoothed peak array

/**
 * Majority filter: each cell takes the peak month that is most common among
 * its neighbours, weighting stronger seasons more. Removes single-cell
 * speckle (neighbours whose peaks differ by a few percent) but keeps the
 * regional pattern. Longitude wraps around; cells without data stay empty.
 * Cached per dataset, so switching views or pages doesn't redo it.
 */
export function smoothPeaks(peak, amp) {
  const cached = smoothCache.get(peak);
  if (cached) return cached;
  const out = new Int8Array(peak.length).fill(-1);
  const votes = new Float64Array(12);
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const p = r * W + c;
      if (peak[p] < 0) continue;
      votes.fill(0);
      for (let dr = -SMOOTH_RADIUS; dr <= SMOOTH_RADIUS; dr++) {
        const rr = r + dr;
        if (rr < 0 || rr >= H) continue;
        for (let dc = -SMOOTH_RADIUS; dc <= SMOOTH_RADIUS; dc++) {
          const q = rr * W + ((c + dc + W) % W);
          if (peak[q] >= 0) votes[peak[q]] += 0.15 + Math.max(0, Math.min(1, strengthOf(amp[q])));
        }
      }
      let best = peak[p];
      for (let m = 0; m < 12; m++) if (votes[m] > votes[best]) best = m;
      out[p] = best;
    }
  }
  smoothCache.set(peak, out);
  return out;
}
