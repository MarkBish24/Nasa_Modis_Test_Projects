import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { useWidth } from "./useWidth.js";
import { GRID, INK, MONTHS, MUTED, REGION_COLORS, fmtChl } from "./colors.js";

const HEIGHT = 280;
const MARGIN = { top: 24, right: 12, bottom: 26, left: 44 };
const CHL_TICKS = [0.02, 0.03, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5, 0.7, 1];
const REL_TICKS = [0.25, 0.35, 0.5, 0.7, 1, 1.4, 2, 2.8];
const relLabel = (v) => ({ 0.25: "¼×", 0.5: "½×" })[v] ?? `${v}×`;
const chlFormat = d3.format("~g");
const absText = (v) => `${fmtChl(v)} mg/m³`;
const relText = (v) => `${v.toFixed(2)}× its mean`;

/**
 * One line chart. `focus` is the region to emphasize (hovered, else selected),
 * `selected` the clicked one. Hovering calls setHover, clicking calls onSelect.
 */
function Panel({ series, title, ticks, tickFormat, refLine, focus, selected, setHover, onSelect, valueText }) {
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

    const all = series.flatMap((s) => s.values.filter((v) => v != null));
    const [lo, hi] = d3.extent(all);
    const x = d3.scalePoint(d3.range(12), [0, w]).padding(0.3);
    const y = d3.scaleLog([lo * 0.9, hi * 1.1], [h, 0]);

    g.append("g")
      .call(d3.axisLeft(y).tickValues(ticks.filter((v) => v >= lo * 0.9 && v <= hi * 1.1)).tickFormat(tickFormat).tickSize(-w))
      .call((a) => a.select(".domain").remove())
      .call((a) => a.selectAll("line").attr("stroke", GRID))
      .call((a) => a.selectAll("text").attr("fill", MUTED));
    if (refLine) g.append("line").attr("x2", w).attr("y1", y(1)).attr("y2", y(1)).attr("stroke", INK).attr("stroke-width", 0.7);
    g.append("g").attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).tickFormat((m) => MONTHS[m][0]).tickSize(0).tickPadding(8))
      .call((a) => a.select(".domain").remove())
      .call((a) => a.selectAll("text").attr("fill", MUTED));

    const line = d3.line((_, m) => x(m), (v) => y(v)).defined((v) => v != null);
    const groups = g.selectAll("g.series").data(series).join("g").attr("class", "series")
      .style("cursor", "pointer")
      .on("mouseenter", (_, s) => setHover(s.name))
      .on("mouseleave", () => setHover(null))
      .on("click", (_, s) => onSelect(s.name));
    // wide invisible stroke, so a 2px line is easy to hover and click
    groups.append("path").attr("class", "hit").attr("d", (s) => line(s.values)).attr("fill", "none")
      .attr("stroke", "transparent").attr("stroke-width", 14);
    groups.append("path").attr("class", "line").attr("d", (s) => line(s.values)).attr("fill", "none")
      .attr("stroke", (s) => s.color).attr("stroke-width", 2.2);
    groups.selectAll("circle").data((s) => s.values.map((v, m) => ({ v, m, s })).filter((d) => d.v != null))
      .join("circle").attr("cx", (d) => x(d.m)).attr("cy", (d) => y(d.v)).attr("r", 3.2).attr("fill", (d) => d.s.color)
      .append("title").text((d) => `${d.s.name}, ${MONTHS[d.m]}: ${valueText(d.v)}`);
  }, [width, series, title, ticks, tickFormat, refLine, setHover, onSelect, valueText]);

  // emphasis only restyles the existing lines, so nothing is redrawn under the pointer
  useEffect(() => {
    const groups = d3.select(svgRef.current).selectAll("g.series")
      .attr("opacity", (s) => (focus && focus !== s.name ? 0.18 : 1));
    groups.select("path.line").attr("stroke-width", (s) => (s.name === selected ? 3.4 : 2.2));
    groups.selectAll("circle").attr("r", (d) => (d.s.name === selected ? 4 : 3.2));
    groups.filter((s) => s.name === selected).raise(); // draw the selected line on top
  }, [focus, selected, width, series]);

  return <div ref={ref}><svg ref={svgRef} role="img" aria-label={title} /></div>;
}

/** Legend shared by both panels: hover to preview a region, click to select it. */
function Legend({ series, focus, selected, setHover, onSelect }) {
  const ref = useRef(null);

  useEffect(() => {
    const buttons = d3.select(ref.current).selectAll("li").data(series, (s) => s.name).join("li")
      .selectAll("button").data((s) => [s]).join("button").attr("type", "button")
      .on("mouseenter", (_, s) => setHover(s.name))
      .on("mouseleave", () => setHover(null))
      .on("click", (_, s) => onSelect(s.name));
    buttons.selectAll("*").remove();
    buttons.append("span").attr("class", "swatch").style("background", (s) => s.color);
    buttons.append("span").text((s) => s.name);
    buttons.append("span").attr("class", "legend-tag").text("Selected");
  }, [series, setHover, onSelect]);

  useEffect(() => {
    d3.select(ref.current).selectAll("li")
      .classed("dim", (s) => focus && focus !== s.name)
      .classed("selected", (s) => s.name === selected)
      .select("button").attr("aria-pressed", (s) => String(s.name === selected));
  }, [focus, selected, series]);

  return <ul className="legend" ref={ref} aria-label="Regions: click to select" />;
}

/** 7. Seasonal cycles of five contrasting regions, absolute and relative to their own mean. */
export default function RegionCycles({ data }) {
  const [hover, setHover] = useState(null);
  const [selected, setSelected] = useState(null);
  // clicking the selected region clears it; clicking another one switches to it
  const onSelect = useCallback((name) => setSelected((cur) => (cur === name ? null : name)), []);
  const focus = hover ?? selected;

  const { series, abs, rel } = useMemo(() => {
    const series = data.regionCycles.map((r, i) => ({ name: r.name, color: REGION_COLORS[i], values: r.values }));
    const abs = series.map((s) => ({ ...s, values: s.values.map((v) => (v == null ? null : 10 ** v)) }));
    const rel = series.map((s) => {
      const mean = d3.mean(s.values.filter((v) => v != null));
      return { ...s, values: s.values.map((v) => (v == null ? null : 10 ** (v - mean))) };
    });
    return { series, abs, rel };
  }, [data]);

  const shared = { focus, selected, setHover, onSelect };
  return (
    <>
      <div className="grid-2">
        <Panel series={abs} title="Chlorophyll-a (mg/m³, log)" ticks={CHL_TICKS} tickFormat={chlFormat}
          valueText={absText} {...shared} />
        <Panel series={rel} title="÷ region's own annual mean" ticks={REL_TICKS} tickFormat={relLabel} refLine
          valueText={relText} {...shared} />
      </div>
      <Legend series={series} {...shared} />
    </>
  );
}
