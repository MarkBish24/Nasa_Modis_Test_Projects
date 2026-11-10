import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import RasterMap from "./RasterMap.jsx";
import { H, W } from "../data/derive.js";
import { MONTHS, wheel } from "./colors.js";

// Seasonal swing (max / min of the 12 monthly values). Below WEAK the "peak
// month" means little, so the cell is plain gray; from WEAK to STRONG the
// color gets more saturated.
const WEAK = Math.log2(1.5);
const STRONG = Math.log2(4);
const strengthOf = (ampLog10) => (ampLog10 * Math.log2(10) - WEAK) / (STRONG - WEAK); // < 0 = weak season

const SMOOTH_RADIUS = 2; // cells: a 5 x 5 window, about 2.5 degrees

const LEVELS = 16;
const rgb = (css) => { const c = d3.rgb(css); return [c.r, c.g, c.b]; };
// [month][level] -> rgb; chroma from 55% to 100%, so no muddy near-grays
const TABLE = MONTHS.map((_, m) => d3.range(LEVELS).map((i) => rgb(wheel(m / 12, 0.55 + (0.45 * i) / (LEVELS - 1)))));
const WEAK_RGB = rgb(wheel(0, 0)); // neutral gray at the same lightness as the colors
const FADED_RGB = rgb("#dcdad3"); // everything outside the focused month
const swatch = (m) => wheel(m / 12, 1);

/**
 * Majority filter: each cell takes the peak month that is most common among
 * its neighbours, weighting stronger seasons more. Removes single-cell
 * speckle (neighbours whose peaks differ by a few percent) but keeps the
 * regional pattern. Longitude wraps around; cells without data stay empty.
 */
function smoothPeaks(peak, amp) {
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
  return out;
}

/** Clickable month legend: hover previews a month, click keeps it, click again clears. */
function MonthLegend({ focus, selected, setHover, onSelect }) {
  const ref = useRef(null);

  useEffect(() => {
    const buttons = d3.select(ref.current).select("ol").selectAll("li").data(d3.range(12)).join("li")
      .selectAll("button").data((m) => [m]).join("button").attr("type", "button")
      .attr("title", (m) => `Show only areas that peak in ${MONTHS[m]}`)
      .on("mouseenter", (_, m) => setHover(m))
      .on("mouseleave", () => setHover(null))
      .on("click", (_, m) => onSelect(m));
    buttons.selectAll("*").remove();
    buttons.append("span").attr("class", "month-swatch").style("background", swatch);
    buttons.append("span").text((m) => MONTHS[m]);
  }, [setHover, onSelect]);

  useEffect(() => {
    d3.select(ref.current).selectAll("li")
      .classed("dim", (m) => focus != null && focus !== m)
      .classed("selected", (m) => m === selected)
      .select("button").attr("aria-pressed", (m) => String(m === selected));
  }, [focus, selected]);

  return (
    <div className="month-legend" ref={ref}>
      <p className="month-legend-title">
        Peak month <span className="muted">· hover or click a month to show only the areas that peak then</span>
      </p>
      <ol aria-label="Peak month: click to show only that month" />
      <p className="month-legend-weak">
        <span className="month-swatch" style={{ background: wheel(0, 0) }} />
        Gray: seasonal swing under 1.5× (weak season, so the peak month means little). Brighter color = stronger season.
      </p>
    </div>
  );
}

/** 6. A calendar of blooms: hue = month of peak chlorophyll (smoothed), gray = weak season. */
export default function PeakMonthMap({ data }) {
  const { peak, amp, land } = data;
  const [hover, setHover] = useState(null);
  const [selected, setSelected] = useState(null);
  const onSelect = useCallback((m) => setSelected((cur) => (cur === m ? null : m)), []);
  const focus = hover ?? selected;

  const smooth = useMemo(() => smoothPeaks(peak, amp), [peak, amp]);

  const colorAt = useMemo(() => (p) => {
    const m = smooth[p];
    if (m < 0) return null;
    const s = strengthOf(amp[p]);
    if (focus != null && (m !== focus || s < 0)) return FADED_RGB;
    if (s < 0) return WEAK_RGB;
    return TABLE[m][Math.round(Math.min(1, s) * (LEVELS - 1))];
  }, [smooth, amp, focus]);

  const describe = useMemo(() => (p) => {
    if (peak[p] < 0) return null;
    const swing = `max ÷ min = ${(10 ** amp[p]).toFixed(1)}×`;
    if (strengthOf(amp[p]) < 0) return `Weak season (${swing})`;
    const area = smooth[p] !== peak[p] ? ` (area around it: ${MONTHS[smooth[p]]})` : "";
    return `Peaks in ${MONTHS[peak[p]]}${area} · ${swing}`;
  }, [peak, amp, smooth]);

  return (
    <>
      <RasterMap colorAt={colorAt} describe={describe} land={land} />
      <MonthLegend focus={focus} selected={selected} setHover={setHover} onSelect={onSelect} />
    </>
  );
}
