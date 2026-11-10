import { useCallback, useMemo, useState } from "react";
import RasterMap from "./RasterMap.jsx";
import ColorBar from "./ColorBar.jsx";
import { N } from "../data/derive.js";
import { MONTHS, anomRamp, fmtChl, lut } from "./colors.js";

const VMAX = 2; // log2 units: 1/4x .. 4x
const TICKS = [
  { t: 0, label: "¼×" }, { t: 0.25, label: "½×" }, { t: 0.5, label: "1× (usual)" },
  { t: 0.75, label: "2×" }, { t: 1, label: "4×" },
];
const SHOWN = [2, 5, 8, 11]; // Mar, Jun, Sep, Dec
const { table, n } = lut(anomRamp);

function MonthMap({ m, data, hoverCell, onHoverCell }) {
  const { clim, annual, land } = data;

  const colorAt = useMemo(() => (p) => {
    const v = clim[m * N + p];
    const a = annual[p];
    if (Number.isNaN(v) || Number.isNaN(a)) return null;
    const t = Math.max(0, Math.min(1, ((v - a) * Math.log2(10) + VMAX) / (2 * VMAX)));
    const i = Math.round(t * (n - 1)) * 3;
    return [table[i], table[i + 1], table[i + 2]];
  }, [clim, annual, m]);

  const describe = useMemo(() => (p) => {
    const v = clim[m * N + p];
    const a = annual[p];
    if (Number.isNaN(v) || Number.isNaN(a)) return null;
    return `${fmtChl(10 ** v)} mg/m³ · ${(10 ** (v - a)).toFixed(2)}× its annual mean`;
  }, [clim, annual, m]);

  return (
    <figure className="small-multiple">
      <figcaption>{MONTHS[m]}</figcaption>
      <RasterMap colorAt={colorAt} describe={describe} land={land} compact
        hoverCell={hoverCell} onHoverCell={onHoverCell} />
    </figure>
  );
}

/** 4. This month vs. the usual: each cell divided by its own annual geometric mean. */
export default function AnomalyMaps({ data }) {
  // the grid cell under the mouse on any of the four maps, shown on all of them
  const [hoverCell, setHoverCell] = useState(null);
  // mousemove fires many times per cell; only re-render when the cell changes
  const onHoverCell = useCallback((next) => setHoverCell((cur) =>
    cur && next && cur.row === next.row && cur.col === next.col ? cur : next), []);

  return (
    <>
      <div className="grid-2">
        {SHOWN.map((m) => <MonthMap key={m} m={m} data={data} hoverCell={hoverCell} onHoverCell={onHoverCell} />)}
      </div>
      <ColorBar colorAt={anomRamp} ticks={TICKS} title="Chlorophyll this month ÷ that spot's annual average" />
    </>
  );
}
