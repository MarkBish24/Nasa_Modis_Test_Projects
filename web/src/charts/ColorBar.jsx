import { useEffect, useId, useRef } from "react";
import * as d3 from "d3";
import { useWidth } from "./useWidth.js";
import { INK, MUTED } from "./colors.js";

/**
 * Horizontal color legend.
 *   colorAt(t) -> css color, t in [0, 1]
 *   ticks      -> [{ t, label }]
 *   steps      -> draw n discrete blocks instead of a smooth gradient
 */
export default function ColorBar({ colorAt, ticks, title, steps = 0, maxWidth = 460 }) {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const width = Math.min(useWidth(wrapRef), maxWidth);
  const gradId = useId().replace(/:/g, "");

  useEffect(() => {
    if (!width) return;
    const pad = 14;
    const barW = width - 2 * pad;
    const svg = d3.select(svgRef.current).attr("width", width).attr("height", 52);
    svg.selectAll("*").remove();
    const g = svg.append("g").attr("transform", `translate(${pad},18)`);

    svg.append("text").attr("x", pad).attr("y", 11).attr("font-size", 11).attr("fill", INK).text(title);

    if (steps) {
      g.selectAll("rect").data(d3.range(steps)).join("rect")
        .attr("x", (i) => (i * barW) / steps).attr("width", barW / steps + 0.5).attr("height", 12)
        .attr("fill", (i) => colorAt(i / steps));
    } else {
      const grad = svg.append("defs").append("linearGradient").attr("id", gradId);
      grad.selectAll("stop").data(d3.range(0, 1.0001, 1 / 32)).join("stop")
        .attr("offset", (t) => t).attr("stop-color", colorAt);
      g.append("rect").attr("width", barW).attr("height", 12).attr("fill", `url(#${gradId})`);
    }

    const t = g.selectAll("g.tick").data(ticks).join("g").attr("transform", (d) => `translate(${d.t * barW},12)`);
    t.append("line").attr("y2", 4).attr("stroke", MUTED);
    t.append("text").attr("y", 16)
      .attr("text-anchor", (d) => (d.t <= 0 && d.label.length > 3 ? "start" : d.t >= 1 && d.label.length > 3 ? "end" : "middle")).attr("font-size", 10).attr("fill", MUTED).text((d) => d.label);
  }, [width, colorAt, ticks, title, steps, gradId]);

  return (
    <div className="colorbar" ref={wrapRef}>
      <svg ref={svgRef} role="img" aria-label={title} />
    </div>
  );
}
