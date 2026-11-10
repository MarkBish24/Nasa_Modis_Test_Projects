import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { useWidth } from "./useWidth.js";
import ColorBar from "./ColorBar.jsx";
import { INK, MONTHS, MUTED, NODATA, anomRamp, chlRamp, fmtChl, logT } from "./colors.js";

const HEIGHT = 340;
const MARGIN = { top: 22, right: 8, bottom: 22, left: 36 };
const LAT_TOP = 85;
const LAT_BOTTOM = -80;
const CONC = { lo: 0.05, hi: 2 };
const REL_MAX = 1.5; // log2 units

const CONC_TICKS = [0.05, 0.1, 0.2, 0.5, 1, 2].map((v) => ({ t: logT(v, CONC.lo, CONC.hi), label: String(v) }));
const REL_TICKS = [{ t: (REL_MAX - 1) / (2 * REL_MAX), label: "½×" }, { t: 0.5, label: "1×" }, { t: (REL_MAX + 1) / (2 * REL_MAX), label: "2×" }];

function Heatmap({ bands, title, fill, describe }) {
  const ref = useRef(null);
  const svgRef = useRef(null);
  const width = useWidth(ref);

  useEffect(() => {
    if (!width) return;
    const w = width - MARGIN.left - MARGIN.right;
    const h = HEIGHT - MARGIN.top - MARGIN.bottom;
    const svg = d3.select(svgRef.current).attr("width", width).attr("height", HEIGHT);
    svg.selectAll("*").remove();
    svg.append("text").attr("x", MARGIN.left).attr("y", 14).attr("font-size", 12.5).attr("fill", INK).text(title);
    const g = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    const x = d3.scaleBand(d3.range(12), [0, w]);
    const y = d3.scaleLinear([LAT_BOTTOM, LAT_TOP], [h, 0]).clamp(true);
    g.append("rect").attr("width", w).attr("height", h).attr("fill", NODATA);

    const cells = bands.flatMap((b) => d3.range(12).map((m) => ({ b, m, color: fill(b, m) })))
      .filter((d) => d.color && d.b.latBottom < LAT_TOP && d.b.latTop > LAT_BOTTOM);
    g.selectAll("rect.cell").data(cells).join("rect").attr("class", "cell")
      .attr("x", (d) => x(d.m)).attr("width", x.bandwidth() + 0.5)
      .attr("y", (d) => y(d.b.latTop)).attr("height", (d) => y(d.b.latBottom) - y(d.b.latTop) + 0.5)
      .attr("fill", (d) => d.color)
      .append("title").text((d) => `${MONTHS[d.m]}, ${d.b.latBottom}° to ${d.b.latTop}°: ${describe(d.b, d.m)}`);

    g.append("line").attr("x2", w).attr("y1", y(0)).attr("y2", y(0)).attr("stroke", INK).attr("stroke-width", 0.6);
    g.append("g").attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).tickFormat((m) => MONTHS[m][0]).tickSize(0).tickPadding(6))
      .call((a) => a.select(".domain").remove()).call((a) => a.selectAll("text").attr("fill", MUTED));
    g.append("g")
      .call(d3.axisLeft(y).tickValues([-60, -30, 0, 30, 60]).tickSize(0).tickPadding(5)
        .tickFormat((v) => (v === 0 ? "0°" : `${Math.abs(v)}°${v < 0 ? "S" : "N"}`)))
      .call((a) => a.select(".domain").remove()).call((a) => a.selectAll("text").attr("fill", MUTED));
  }, [width, bands, title, fill, describe]);

  return <div ref={ref}><svg ref={svgRef} role="img" aria-label={title} /></div>;
}

const concFill = (b, m) => (Number.isNaN(b.z[m]) ? null : chlRamp(logT(10 ** b.z[m], CONC.lo, CONC.hi)));
const relFill = (b, m) => (Number.isNaN(b.rel[m]) ? null : anomRamp((b.rel[m] + REL_MAX) / (2 * REL_MAX)));
const concText = (b, m) => `${fmtChl(10 ** b.z[m])} mg/m³`;
const relText = (b, m) => `${(2 ** b.rel[m]).toFixed(2)}× the band's annual mean`;

/** 5. Latitude x month (Hovmöller): every 2-degree band of ocean, month by month. */
export default function LatitudeMonth({ data }) {
  return (
    <div className="grid-2">
      <div>
        <Heatmap bands={data.bands} title="Chlorophyll (mg/m³)" fill={concFill} describe={concText} />
        <ColorBar colorAt={chlRamp} ticks={CONC_TICKS} title="mg/m³ (log)" />
      </div>
      <div>
        <Heatmap bands={data.bands} title="Divided by each band's annual mean" fill={relFill} describe={relText} />
        <ColorBar colorAt={anomRamp} ticks={REL_TICKS} title="÷ band's annual mean" />
      </div>
    </div>
  );
}
