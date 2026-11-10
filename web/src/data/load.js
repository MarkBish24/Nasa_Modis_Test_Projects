import { useEffect, useState } from "react";
import * as topojson from "topojson-client";
import { derive } from "./derive.js";

const url = (name) => `${import.meta.env.BASE_URL}data/${name}`;

async function fetchJSON(name) {
  const r = await fetch(url(name));
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  return r.json();
}

// chl_clim.bin.gz is gzip on disk. GitHub Pages serves it as-is, but some dev
// servers add Content-Encoding: gzip and the browser unzips it for us, so check
// the gzip magic bytes before decompressing.
async function fetchClimatology() {
  const r = await fetch(url("chl_clim.bin.gz"));
  if (!r.ok) throw new Error(`chl_clim.bin.gz: HTTP ${r.status}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf[0] !== 0x1f || buf[1] !== 0x8b) return buf;
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

let cache = null;

export function loadData() {
  if (!cache) {
    cache = Promise.all([
      fetchJSON("meta.json"),
      fetchJSON("aggregates.json"),
      fetchJSON("land-50m.json"),
      fetchClimatology(),
    ]).then(([meta, agg, landTopo, bytes]) => ({
      meta,
      agg,
      land: topojson.feature(landTopo, landTopo.objects.land),
      ...derive(bytes, meta),
    }));
    cache.catch(() => (cache = null)); // allow a retry after a failed load
  }
  return cache;
}

export function useData() {
  const [state, setState] = useState({ status: "loading" });
  useEffect(() => {
    let live = true;
    loadData().then(
      (data) => live && setState({ status: "ready", data }),
      (error) => live && setState({ status: "error", error })
    );
    return () => (live = false);
  }, []);
  return state;
}
