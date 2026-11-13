import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import { useWidth } from "./useWidth.js";
import { H, LATS, LONS, W } from "../data/derive.js";
import { INK, LAND_FILL, LAND_STROKE, MUTED, NODATA, fmtLat, fmtLon } from "./colors.js";

// Shown latitude range, as in the matplotlib maps (no ocean data poleward of it).
const LAT_TOP = 85;
const LAT_BOTTOM = -80;
const MARGIN = { top: 4, right: 8, bottom: 20, left: 34 };

const rasterCache = new WeakMap(); // colorAt function -> 720 x 360 canvas

function rasterFor(colorAt) {
  let off = rasterCache.get(colorAt);
  if (off) return off;
  off = document.createElement("canvas");
  off.width = W;
  off.height = H;
  const ctx = off.getContext("2d");
  const img = ctx.createImageData(W, H);
  for (let p = 0; p < W * H; p++) {
    const rgb = colorAt(p);
    if (!rgb) continue;
    img.data[p * 4] = rgb[0];
    img.data[p * 4 + 1] = rgb[1];
    img.data[p * 4 + 2] = rgb[2];
    img.data[p * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  rasterCache.set(colorAt, off);
  return off;
}

/** Size a canvas for the screen's pixel density; returns a context in CSS pixels. */
function sizeCanvas(canvas, w, h) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/**
 * Equirectangular map of a 720 x 360 grid: canvas raster + land drawn on top,
 * D3 axes in an SVG overlay, and a hover tooltip.
 *
 *   colorAt(p)  -> [r, g, b] for grid cell p (row-major, row 0 = 90N), or null for no data
 *   describe(p) -> tooltip text for cell p, or null for no data
 *   hoverCell, onHoverCell -> optional; link several maps' hover (see below)
 *   boxes       -> optional [{ lon: [west, east], lat: [south, north], label }] outlines to draw
 */
export default function RasterMap({ colorAt, describe, land, compact = false, hoverCell, onHoverCell, boxes }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const landRef = useRef(null);
  const svgRef = useRef(null);
  const tipRef = useRef(null);
  const markerRef = useRef(null);
  const boxesRef = useRef(null);
  const width = useWidth(wrapRef);

  const margin = compact ? { ...MARGIN, left: 30 } : MARGIN;
  const plotW = Math.max(0, width - margin.left - margin.right);
  const plotH = Math.round((plotW * (LAT_TOP - LAT_BOTTOM)) / 360);

  // the full-resolution raster for this colorAt (cached, so a timelapse that
  // revisits a frame doesn't rebuild it)
  const raster = useMemo(() => rasterFor(colorAt), [colorAt]);

  const projection = useMemo(() => {
    const k = plotW / (2 * Math.PI);
    return d3.geoEquirectangular().scale(k).translate([plotW / 2, (k * LAT_TOP * Math.PI) / 180]);
  }, [plotW]);

  // data layer: redrawn whenever the raster changes
  useEffect(() => {
    if (!plotW) return;
    const ctx = sizeCanvas(canvasRef.current, plotW, plotH);
    ctx.fillStyle = NODATA;
    ctx.fillRect(0, 0, plotW, plotH);
    ctx.imageSmoothingEnabled = false;
    const row0 = (90 - LAT_TOP) / 0.5;
    const rows = (LAT_TOP - LAT_BOTTOM) / 0.5;
    ctx.drawImage(raster, 0, row0, W, rows, 0, 0, plotW, plotH);
  }, [raster, plotW, plotH]);

  // land layer on its own canvas: the coastlines are the slow part to draw and
  // never change, so they are only redrawn on resize
  useEffect(() => {
    if (!plotW) return;
    const ctx = sizeCanvas(landRef.current, plotW, plotH);
    ctx.clearRect(0, 0, plotW, plotH);
    ctx.beginPath();
    d3.geoPath(projection, ctx)(land);
    ctx.fillStyle = LAND_FILL;
    ctx.fill();
    ctx.lineWidth = 0.4;
    ctx.strokeStyle = LAND_STROKE;
    ctx.stroke();
  }, [land, projection, plotW, plotH]);

  // labelled outline boxes (e.g. the region a guided story is about)
  useEffect(() => {
    const svg = d3.select(boxesRef.current).attr("width", plotW).attr("height", plotH);
    svg.selectAll("*").remove();
    if (!plotW || !boxes?.length) return;
    const x = (lon) => ((lon + 180) / 360) * plotW;
    const y = (lat) => ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * plotH;
    const g = svg.selectAll("g").data(boxes).join("g");
    for (const [color, sw] of [["white", 4], [INK, 2]]) {
      g.append("rect")
        .attr("x", (b) => x(b.lon[0])).attr("y", (b) => y(b.lat[1]))
        .attr("width", (b) => x(b.lon[1]) - x(b.lon[0])).attr("height", (b) => y(b.lat[0]) - y(b.lat[1]))
        .attr("fill", "none").attr("stroke", color).attr("stroke-width", sw).attr("rx", 2);
    }
    g.append("text")
      .attr("x", (b) => x(b.lon[0])).attr("y", (b) => y(b.lat[1]) - 6)
      .attr("font-size", 12).attr("font-weight", 600).attr("fill", INK)
      .attr("stroke", "white").attr("stroke-width", 3.5).attr("paint-order", "stroke")
      .text((b) => b.label ?? "");
  }, [boxes, plotW, plotH]);

  // axis labels
  useEffect(() => {
    if (!plotW) return;
    const svg = d3.select(svgRef.current).attr("width", width).attr("height", plotH + margin.top + margin.bottom);
    svg.selectAll("*").remove();
    const x = d3.scaleLinear([-180, 180], [0, plotW]);
    const y = d3.scaleLinear([LAT_BOTTOM, LAT_TOP], [plotH, 0]);
    const lonStep = plotW < 420 ? 120 : 60;
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`)
      .attr("font-size", compact ? 9 : 10).attr("fill", MUTED);
    g.selectAll("text.lon").data(d3.range(-180, 181, lonStep)).join("text")
      .attr("x", x).attr("y", plotH + 14).attr("text-anchor", (d) => (d === -180 ? "start" : d === 180 ? "end" : "middle"))
      .text((d) => (d === 0 ? "0°" : fmtLon(d).replace(".0", "")));
    g.selectAll("text.lat").data(d3.range(-60, 61, 30)).join("text")
      .attr("x", -5).attr("y", y).attr("dy", "0.32em").attr("text-anchor", "end")
      .text((d) => (d === 0 ? "0°" : fmtLat(d).replace(".0", "")));
  }, [plotW, plotH, width, compact]);

  // Hover is tracked as a grid cell { row, col }. With onHoverCell the map is
  // "linked": it reports the cell up and draws whatever hoverCell it is given,
  // so several maps can show the same spot. Without it, it handles hover itself.
  const linked = onHoverCell !== undefined;

  function cellAt(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const lon = ((e.clientX - rect.left) / plotW) * 360 - 180;
    const lat = LAT_TOP - ((e.clientY - rect.top) / plotH) * (LAT_TOP - LAT_BOTTOM);
    const col = Math.floor((lon + 180) / 0.5);
    const row = Math.floor((90 - lat) / 0.5);
    return col < 0 || col >= W || row < 0 || row >= H ? null : { row, col };
  }

  function showCell(cell) {
    const tip = d3.select(tipRef.current);
    const marker = d3.select(markerRef.current);
    if (!cell || !plotW) {
      tip.style("display", "none");
      marker.selectAll("*").remove();
      return;
    }
    const lat = LATS[cell.row];
    const lon = LONS[cell.col];
    const px = ((lon + 180) / 360) * plotW;
    const py = ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * plotH;
    const text = describe(cell.row * W + cell.col);

    const x = px + margin.left;
    tip.style("display", null).style("left", `${x}px`).style("top", `${py + margin.top}px`)
      .classed("flip", x > width * 0.6);
    tip.selectAll("*").remove();
    tip.append("div").attr("class", "tooltip-coord").text(`${fmtLat(lat)}, ${fmtLon(lon)}`);
    tip.append("div").attr("class", text ? null : "muted").text(text ?? "No reliable data");

    // the box: a cell is under a pixel wide, so draw a fixed-size square around it
    if (!linked) return;
    const half = 6;
    marker.attr("width", plotW).attr("height", plotH).selectAll("*").remove();
    for (const [color, sw] of [["white", 3.5], [INK, 1.5]]) {
      marker.append("rect").attr("x", px - half).attr("y", py - half)
        .attr("width", 2 * half).attr("height", 2 * half)
        .attr("fill", "none").attr("stroke", color).attr("stroke-width", sw);
    }
  }

  // linked maps draw the shared cell whenever it (or the map size) changes
  useEffect(() => {
    if (linked) showCell(hoverCell);
  });

  const onMove = (e) => (linked ? onHoverCell(cellAt(e)) : showCell(cellAt(e)));
  const onLeave = () => (linked ? onHoverCell(null) : showCell(null));

  return (
    <div className="raster-map" ref={wrapRef}>
      <svg ref={svgRef} className="raster-axes" aria-hidden="true" />
      <canvas
        ref={canvasRef}
        style={{ left: margin.left, top: margin.top }}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      />
      <canvas ref={landRef} className="raster-land" style={{ left: margin.left, top: margin.top }} aria-hidden="true" />
      <svg ref={boxesRef} className="raster-marker" style={{ left: margin.left, top: margin.top }} aria-hidden="true" />
      <svg ref={markerRef} className="raster-marker" style={{ left: margin.left, top: margin.top }} aria-hidden="true" />
      <div className="tooltip" ref={tipRef} style={{ display: "none" }} />
    </div>
  );
}
