import { useCallback, useEffect, useMemo, useState } from "react";
import RasterMap from "./RasterMap.jsx";
import ColorBar from "./ColorBar.jsx";
import { N } from "../data/derive.js";
import { MONTHS, chlRamp, fmtChl, logT, lut } from "./colors.js";

const LO = 0.02;
const HI = 10;
const TICKS = [0.03, 0.1, 0.3, 1, 3, 10].map((v) => ({ t: logT(v, LO, HI), label: String(v) }));
const { table, n } = lut(chlRamp);
const LOG_LO = Math.log10(LO);
const LOG_HI = Math.log10(HI);
const FRAME_MS = 900; // time per month while playing
const ANNUAL = -1; // frame index for the annual-average map

/**
 * 1. Where is the ocean green? A timelapse of the monthly climatology
 * (Jan..Dec, each the 2003-2022 average for that month), plus the annual mean.
 */
export default function AnnualMap({ data }) {
  const { clim, annual, land } = data;
  const [frame, setFrame] = useState(ANNUAL);
  const [playing, setPlaying] = useState(false);

  // shared-hover mode, so the tooltip follows the frame while the mouse stays still
  const [hoverCell, setHoverCell] = useState(null);
  const onHoverCell = useCallback((next) => setHoverCell((cur) =>
    cur && next && cur.row === next.row && cur.col === next.col ? cur : next), []);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setFrame((f) => (f + 1) % 12), FRAME_MS);
    return () => clearInterval(id);
  }, [playing]);

  const togglePlay = () => {
    if (!playing && frame === ANNUAL) setFrame(0);
    setPlaying(!playing);
  };

  // one stable colorAt per frame (annual + 12 months), so RasterMap's cache
  // can reuse each frame's raster after the first pass
  const frames = useMemo(() => {
    const make = (values) => (p) => {
      const v = values[p]; // log10(chl)
      if (Number.isNaN(v)) return null;
      const i = Math.round(Math.max(0, Math.min(1, (v - LOG_LO) / (LOG_HI - LOG_LO))) * (n - 1)) * 3;
      return [table[i], table[i + 1], table[i + 2]];
    };
    return {
      annual: { values: annual, colorAt: make(annual) },
      months: MONTHS.map((_, m) => {
        const values = clim.subarray(m * N, (m + 1) * N);
        return { values, colorAt: make(values) };
      }),
    };
  }, [clim, annual]);
  const { values, colorAt } = frame === ANNUAL ? frames.annual : frames.months[frame];

  const describe = useMemo(() => (p) => {
    const v = values[p];
    if (Number.isNaN(v)) return null;
    return `${frame === ANNUAL ? "Annual mean" : MONTHS[frame]}: ${fmtChl(10 ** v)} mg/m³`;
  }, [values, frame]);

  return (
    <>
      <div className="timelapse">
        <button className="play-button" onClick={togglePlay} aria-label={playing ? "Pause" : "Play the seasons"}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            {playing ? <path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" /> : <path d="M4 2.5v11l9-5.5z" />}
          </svg>
        </button>
        <output className="timelapse-label" aria-live="polite">
          {frame === ANNUAL ? "Annual average" : MONTHS[frame]}
        </output>
        <div className={`timelapse-slider${frame === ANNUAL ? " inactive" : ""}`}>
          <input
            type="range" min="0" max="11" step="1" aria-label="Month"
            value={frame === ANNUAL ? 0 : frame}
            onChange={(e) => { setPlaying(false); setFrame(Number(e.target.value)); }}
          />
          <div className="timelapse-ticks" aria-hidden="true">
            {MONTHS.map((m, i) => <span key={m} className={i === frame ? "current" : ""}>{m[0]}</span>)}
          </div>
        </div>
        <button
          className={`annual-button${frame === ANNUAL ? " active" : ""}`}
          aria-pressed={frame === ANNUAL}
          onClick={() => { setPlaying(false); setFrame(ANNUAL); }}
        >
          Annual average
        </button>
      </div>
      <RasterMap colorAt={colorAt} describe={describe} land={land} hoverCell={hoverCell} onHoverCell={onHoverCell} />
      <ColorBar colorAt={chlRamp} ticks={TICKS} title="Chlorophyll-a (mg/m³, log scale)" />
    </>
  );
}
