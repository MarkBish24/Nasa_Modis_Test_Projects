import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { useWidth } from "./useWidth.js";
import { GRID, INK, MONTHS, MUTED, REGION_COLORS, fmtChl } from "./colors.js";

const NAMES = ["North Atlantic", "Southern Ocean", "Equatorial Pacific"];
// NOAA Oceanic Nino Index El Nino episodes (moderate or stronger) inside 2003-2022
const EL_NINO = [[2009 + 6 / 12, 2010 + 4 / 12], [2015 + 2 / 12, 2016 + 5 / 12]];
const CHL_TICKS = [0.02, 0.03, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5, 0.7, 1, 1.5, 2, 3, 5];
const PANEL_H = 120;
const GAP = 14;
const MARGIN = { top: 6, right: 12, bottom: 24, left: 44 };

/** 3. Seasons vs. years: 20 years of monthly composites for three regions. */
export default function RegionalSeries({ data }) {
  const ref = useRef(null);
  const svgRef = useRef(null);
  const width = useWidth(ref);
  const { agg, meta } = data;

  useEffect(() => {
    if (!width) return;
    const rows = agg.series.map((r) => ({ ...r, t: r.year + (r.month - 0.5) / 12 }));
    const colorOf = Object.fromEntries(Object.keys(meta.regions).map((name, i) => [name, REGION_COLORS[i]]));
    const w = width - MARGIN.left - MARGIN.right;
    const height = MARGIN.top + NAMES.length * PANEL_H + (NAMES.length - 1) * GAP + MARGIN.bottom;
    const svg = d3.select(svgRef.current).attr("width", width).attr("height", height);
    svg.selectAll("*").remove();

    const [y0, y1] = meta.years;
    const x = d3.scaleLinear([y0, y1 + 1], [0, w]);

    const panels = NAMES.map((name, k) => {
      const pts = rows.filter((r) => r[name] != null).map((r) => ({ t: r.t, v: 10 ** r[name], r }));
      const [lo, hi] = d3.extent(pts, (d) => d.v);
      const y = d3.scaleLog([lo * 0.92, hi * 1.08], [PANEL_H, 0]);
      const g = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top + k * (PANEL_H + GAP)})`);

      if (name === "Equatorial Pacific") {
        for (const [a, b] of EL_NINO) {
          g.append("rect").attr("x", x(a)).attr("width", x(b) - x(a)).attr("height", PANEL_H).attr("fill", GRID);
          g.append("text").attr("x", x((a + b) / 2)).attr("y", PANEL_H - 6).attr("text-anchor", "middle")
            .attr("font-size", 10).attr("fill", MUTED).text("El Niño");
        }
      }

      const ticks = CHL_TICKS.filter((v) => v >= y.domain()[0] && v <= y.domain()[1]);
      g.append("g").call(d3.axisLeft(y).tickValues(ticks).tickFormat(d3.format("~g")).tickSize(-w))
        .call((a) => a.select(".domain").remove())
        .call((a) => a.selectAll("line").attr("stroke", GRID))
        .call((a) => a.selectAll("text").attr("fill", MUTED));
      g.append("path").datum(pts)
        .attr("d", d3.line((d) => x(d.t), (d) => y(d.v)))
        .attr("fill", "none").attr("stroke", colorOf[name]).attr("stroke-width", 1.5);
      g.append("text").attr("x", 4).attr("y", 12).attr("font-size", 12).attr("font-weight", 600)
        .attr("fill", INK).text(name);

      // hover marker for this panel; moved by the shared overlay below
      const focus = g.append("g").attr("display", "none").attr("pointer-events", "none");
      // reach up through the gap above, so the three markers read as one line
      focus.append("line").attr("y1", k ? -GAP : 0).attr("y2", PANEL_H).attr("stroke", MUTED).attr("stroke-dasharray", "2,2");
      focus.append("circle").attr("r", 3.5).attr("fill", colorOf[name]).attr("stroke", "white");
      focus.append("text").attr("font-size", 11).attr("fill", INK)
        .attr("stroke", "white").attr("stroke-width", 3).attr("paint-order", "stroke");

      if (k === NAMES.length - 1) {
        g.append("g").attr("transform", `translate(0,${PANEL_H})`)
          .call(d3.axisBottom(x).ticks(Math.min(10, w / 70)).tickFormat(d3.format("d")).tickSizeOuter(0))
          .call((a) => a.selectAll("text").attr("fill", MUTED))
          .call((a) => a.selectAll("line,path").attr("stroke", MUTED));
      }

      const byMonth = new Map(pts.map((d) => [d.t, d]));
      return { y, focus, byMonth };
    });

    // One overlay over all three panels (gaps included): hovering anywhere picks
    // a month and shows that same month in every panel.
    const months = rows.map((r) => r.t);
    const bisect = d3.bisector((t) => t).center;
    const showMonth = (t) => {
      const r = rows[months.indexOf(t)];
      const px = x(t);
      const right = px > w - 170;
      for (const { y, focus, byMonth } of panels) {
        const d = byMonth.get(t);
        focus.attr("display", null);
        focus.select("line").attr("x1", px).attr("x2", px);
        focus.select("circle").attr("display", d ? null : "none").attr("cx", px).attr("cy", d ? y(d.v) : 0);
        focus.select("text")
          .attr("x", px + (right ? -7 : 7))
          .attr("y", d ? Math.max(12, y(d.v) - 8) : 12)
          .attr("text-anchor", right ? "end" : "start")
          .text(`${MONTHS[r.month - 1]} ${r.year}: ${d ? `${fmtChl(d.v)} mg/m³` : "no data"}`);
      }
    };
    svg.append("rect")
      .attr("x", MARGIN.left).attr("y", MARGIN.top)
      .attr("width", w).attr("height", NAMES.length * PANEL_H + (NAMES.length - 1) * GAP)
      .attr("fill", "transparent")
      .on("mousemove", (e) => showMonth(months[bisect(months, x.invert(d3.pointer(e)[0] - MARGIN.left))]))
      .on("mouseleave", () => panels.forEach((p) => p.focus.attr("display", "none")));

    svg.append("text").attr("transform", `translate(12,${height / 2}) rotate(-90)`).attr("text-anchor", "middle")
      .attr("font-size", 11).attr("fill", MUTED).text("Chlorophyll-a (mg/m³, log)");
  }, [width, agg, meta]);

  return <div ref={ref}><svg ref={svgRef} role="img" aria-label="Regional chlorophyll time series, 2003–2022" /></div>;
}
