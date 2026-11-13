import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import RasterMap from "./RasterMap.jsx";
import ColorBar from "./ColorBar.jsx";
import { N } from "../data/derive.js";
import { MONTHS, chlRamp, fmtChl, logT, lut } from "./colors.js";
import { FADED_RGB, WEAK_RGB, peakRGB, smoothPeaks, strengthOf, swatch } from "./peaks.js";

// Chlorophyll color scale (same as graph 1)
const LO = 0.02;
const HI = 10;
const LOG_LO = Math.log10(LO);
const LOG_HI = Math.log10(HI);
const CHL_TICKS = [0.03, 0.1, 0.3, 1, 3, 10].map((v) => ({ t: logT(v, LO, HI), label: String(v) }));
const { table, n } = lut(chlRamp);

export const ALL_YEAR = -1; // "month" index for the annual average / full calendar
const FRAME_MS = 1000;

/**
 * The main graphic: one map, two views, one month bar.
 *   view "chl":      chlorophyll in the chosen month (or the annual average)
 *   view "calendar": the month each place blooms; picking a month shows only
 *                    the places that bloom then, so playing sweeps the bloom
 *                    around the world
 * View, month and region boxes are controlled by the parent (the guided stories
 * set them); `onChange({ view?, month? })` asks the parent to change them, and a
 * new `pauseKey` stops playback.
 */
export default function BloomMap({ data, view, month, boxes, onChange, pauseKey }) {
  const { clim, annual, peak, amp, land } = data;
  const [playing, setPlaying] = useState(false);

  const [hoverCell, setHoverCell] = useState(null);
  const onHoverCell = useCallback((next) => setHoverCell((cur) =>
    cur && next && cur.row === next.row && cur.col === next.col ? cur : next), []);

  // advance one month per tick; read the latest month through a ref so the
  // interval doesn't restart every frame
  // the parent changes pauseKey (e.g. opening a guided stop) to stop playback
  useEffect(() => {
    setPlaying(false);
  }, [pauseKey]);

  const monthRef = useRef(month);
  monthRef.current = month;
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => onChange({ month: (monthRef.current + 1) % 12 }), FRAME_MS);
    return () => clearInterval(id);
  }, [playing, onChange]);

  const smooth = useMemo(() => smoothPeaks(peak, amp), [peak, amp]);

  // one stable colorAt per (view, month), so RasterMap can cache each raster
  const colorFns = useMemo(() => {
    const chl = (values) => (p) => {
      const v = values[p];
      if (Number.isNaN(v)) return null;
      const i = Math.round(Math.max(0, Math.min(1, (v - LOG_LO) / (LOG_HI - LOG_LO))) * (n - 1)) * 3;
      return [table[i], table[i + 1], table[i + 2]];
    };
    const calendar = (only) => (p) => {
      const m = smooth[p];
      if (m < 0) return null;
      const s = strengthOf(amp[p]);
      if (only === ALL_YEAR) return s < 0 ? WEAK_RGB : peakRGB(m, s);
      return s < 0 || m !== only ? FADED_RGB : peakRGB(m, s);
    };
    return {
      chl: { [ALL_YEAR]: chl(annual), ...Object.fromEntries(d3.range(12).map((m) => [m, chl(clim.subarray(m * N, (m + 1) * N))])) },
      calendar: Object.fromEntries([ALL_YEAR, ...d3.range(12)].map((m) => [m, calendar(m)])),
    };
  }, [clim, annual, amp, smooth]);
  const colorAt = colorFns[view][month];

  // tooltip: this month's amount and when the spot blooms, in both views
  const describe = useMemo(() => (p) => {
    const v = month === ALL_YEAR ? annual[p] : clim[month * N + p];
    const when = month === ALL_YEAR ? "Year average" : MONTHS[month];
    const amount = Number.isNaN(v) ? `${when}: no reliable data` : `${when}: ${fmtChl(10 ** v)} mg/m³`;
    if (peak[p] < 0) return Number.isNaN(v) ? null : amount;
    const swing = `${(10 ** amp[p]).toFixed(1)}× swing`;
    const bloom = strengthOf(amp[p]) < 0 ? `weak season (${swing})` : `blooms in ${MONTHS[peak[p]]} (${swing})`;
    return `${amount} · ${bloom}`;
  }, [month, clim, annual, peak, amp]);

  const pickMonth = (m) => { setPlaying(false); onChange({ month: m }); };
  const togglePlay = () => {
    if (!playing && month === ALL_YEAR) onChange({ month: 0 });
    setPlaying(!playing);
  };

  return (
    <div className="bloom-map">
      <div className="bloom-toolbar">
        <div className="segmented" role="radiogroup" aria-label="What the map shows">
          {[["chl", "Chlorophyll"], ["calendar", "Bloom calendar"]].map(([v, label]) => (
            <button key={v} role="radio" aria-checked={view === v} className={view === v ? "active" : ""}
              onClick={() => onChange({ view: v })}>
              {label}
            </button>
          ))}
        </div>
        <output className="bloom-current" aria-live="polite">
          {view === "chl"
            ? (month === ALL_YEAR ? "Average over the whole year" : `Chlorophyll in ${MONTHS[month]}`)
            : (month === ALL_YEAR ? "The month each place blooms" : `Places that bloom in ${MONTHS[month]}`)}
        </output>
      </div>

      <RasterMap colorAt={colorAt} describe={describe} land={land} boxes={boxes}
        hoverCell={hoverCell} onHoverCell={onHoverCell} />

      <div className="month-bar">
        <button className="play-button" onClick={togglePlay} aria-label={playing ? "Pause" : "Play through the year"}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            {playing ? <path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" /> : <path d="M4 2.5v11l9-5.5z" />}
          </svg>
        </button>
        <ol aria-label="Month">
          {MONTHS.map((label, m) => (
            <li key={label}>
              <button className={m === month ? "active" : ""} aria-pressed={m === month} onClick={() => pickMonth(m)}>
                {view === "calendar" && <span className="month-swatch" style={{ background: swatch(m) }} />}
                {label}
              </button>
            </li>
          ))}
        </ol>
        <button className={`all-year${month === ALL_YEAR ? " active" : ""}`} aria-pressed={month === ALL_YEAR}
          onClick={() => pickMonth(ALL_YEAR)}>
          All year
        </button>
      </div>

      {view === "chl" ? (
        <ColorBar colorAt={chlRamp} ticks={CHL_TICKS} title="Chlorophyll-a (mg/m³, log scale)" />
      ) : (
        <p className="bloom-key">
          <span className="month-swatch" style={{ background: "#949494" }} />
          {month === ALL_YEAR
            ? "Each color is the month that place blooms (see the month bar). Gray: the amount barely changes during the year, so there's no real bloom."
            : `Colored: places whose bloom peaks in ${MONTHS[month]}. Everything else is faded. Press play to watch the bloom move around the world.`}
        </p>
      )}
    </div>
  );
}
