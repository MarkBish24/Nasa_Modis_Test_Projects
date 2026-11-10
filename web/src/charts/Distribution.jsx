import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { useWidth } from "./useWidth.js";
import { INK, MUTED } from "./colors.js";

const BAR = "#256abf";
const HEIGHT = 230;
const MARGIN = { top: 26, right: 10, bottom: 38, left: 10 };

function Histogram({ bins, title, xTicks, xLabel, x: xOf, median }) {
  const ref = useRef(null);
  const svgRef = useRef(null);
  const width = useWidth(ref);

  useEffect(() => {
    if (!width) return;
    const w = width - MARGIN.left - MARGIN.right;
    const h = HEIGHT - MARGIN.top - MARGIN.bottom;
    const svg = d3.select(svgRef.current).attr("width", width).attr("height", HEIGHT);
    svg.selectAll("*").remove();
    const g = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    const x = d3.scaleLinear([bins[0].x0, bins.at(-1).x1], [0, w]);
    const y = d3.scaleLinear([0, d3.max(bins, (b) => b.count)], [h, 0]);

    g.selectAll("rect").data(bins).join("rect")
      .attr("x", (b) => x(b.x0) + 0.5).attr("width", (b) => Math.max(0, x(b.x1) - x(b.x0) - 1))
      .attr("y", (b) => y(b.count)).attr("height", (b) => h - y(b.count)).attr("fill", BAR)
      .append("title").text((b) => `${d3.format(".1%")(b.count / d3.sum(bins, (d) => d.count))} of ocean area`);

    g.append("g").attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).tickValues(xTicks.map(xOf)).tickFormat((_, i) => xTicks[i]).tickSizeOuter(0))
      .call((a) => a.selectAll("text").attr("fill", MUTED))
      .call((a) => a.selectAll("line,path").attr("stroke", MUTED));
    g.append("text").attr("x", w / 2).attr("y", h + 32).attr("text-anchor", "middle")
      .attr("font-size", 11).attr("fill", INK).text(xLabel);
    svg.append("text").attr("x", MARGIN.left).attr("y", 15).attr("font-size", 12.5)
      .attr("font-weight", 600).attr("fill", INK).text(title);

    if (median) {
      const mx = x(xOf(median));
      g.append("line").attr("x1", mx).attr("x2", mx).attr("y1", 0).attr("y2", h).attr("stroke", INK);
      g.append("text").attr("x", mx + 6).attr("y", 10).attr("font-size", 10).attr("fill", INK)
        .attr("stroke", "white").attr("stroke-width", 3).attr("paint-order", "stroke")
        .text(`median ${median.toFixed(2)}`);
    }
  }, [width, bins, title, xTicks, xLabel, xOf, median]);

  return <div ref={ref}><svg ref={svgRef} role="img" aria-label={title} /></div>;
}

const LINEAR_TICKS = [0, 1, 2, 3, 4, 5];
const LOG_TICKS = [0.01, 0.03, 0.1, 0.3, 1, 3, 10];
const identity = (v) => v;

/** 2. Why a log scale? The same values on a linear and a log axis. */
export default function Distribution({ data }) {
  const { hist } = data;
  return (
    <div className="grid-2">
      <Histogram bins={hist.linear} title="Linear axis: almost all values pile up near 0"
        xTicks={LINEAR_TICKS} x={identity} xLabel="Chlorophyll-a (mg/m³, linear)" />
      <Histogram bins={hist.log} title="Log axis: roughly bell-shaped (log-normal)"
        xTicks={LOG_TICKS} x={Math.log10} xLabel="Chlorophyll-a (mg/m³, log axis)" median={hist.median} />
    </div>
  );
}
