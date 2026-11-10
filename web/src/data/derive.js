// Turns the quantised climatology (data/chl_clim.bin.gz, see data/meta.json) into
// the derived fields the exploration graphs use. Mirrors explore() in main.py.

export const W = 720;
export const H = 360;
export const N = W * H;
export const CELL = 0.5;
export const MIN_MONTHS = 6; // months with data needed for annual mean / anomaly / peak month

export const LATS = Float64Array.from({ length: H }, (_, i) => 90 - CELL / 2 - CELL * i);
export const LONS = Float64Array.from({ length: W }, (_, j) => -180 + CELL / 2 + CELL * j);
const WEIGHT = LATS.map((lat) => Math.cos((lat * Math.PI) / 180)); // area weight per row

export function derive(bytes, meta) {
  if (bytes.length !== 12 * N) throw new Error(`climatology has ${bytes.length} bytes, expected ${12 * N}`);
  const { log_min: logMin, log_max: logMax } = meta;
  const step = (logMax - logMin) / 254;

  // log10(chl) per [month][row][col], NaN = no data
  const clim = new Float32Array(12 * N);
  for (let i = 0; i < clim.length; i++) clim[i] = bytes[i] === 0 ? NaN : logMin + (bytes[i] - 1) * step;

  // per cell: geometric annual mean, peak month, seasonal range (max - min, log10)
  const annual = new Float32Array(N).fill(NaN);
  const amp = new Float32Array(N).fill(NaN);
  const peak = new Int8Array(N).fill(-1);
  for (let p = 0; p < N; p++) {
    let sum = 0, n = 0, max = -Infinity, min = Infinity, arg = -1;
    for (let m = 0; m < 12; m++) {
      const v = clim[m * N + p];
      if (Number.isNaN(v)) continue;
      sum += v; n++;
      if (v > max) { max = v; arg = m; }
      if (v < min) min = v;
    }
    if (n >= MIN_MONTHS) {
      annual[p] = sum / n;
      amp[p] = max - min;
      peak[p] = arg;
    }
  }

  // area-weighted count of every quantised value -> both histograms + median
  const byteWeights = new Float64Array(256);
  const byteCounts = new Float64Array(256);
  for (let m = 0; m < 12; m++)
    for (let r = 0; r < H; r++) {
      const base = m * N + r * W;
      for (let c = 0; c < W; c++) {
        const b = bytes[base + c];
        if (b) { byteWeights[b] += WEIGHT[r]; byteCounts[b]++; }
      }
    }
  const toLog = (b) => logMin + (b - 1) * step;
  const histogram = (lo, hi, bins, valueOf) => {
    const counts = new Float64Array(bins);
    for (let b = 1; b < 256; b++) {
      const v = valueOf(toLog(b));
      if (v < lo || v > hi) continue;
      counts[Math.min(bins - 1, Math.floor(((v - lo) / (hi - lo)) * bins))] += byteWeights[b];
    }
    return Array.from(counts, (count, i) => ({ x0: lo + ((hi - lo) * i) / bins, x1: lo + ((hi - lo) * (i + 1)) / bins, count }));
  };
  const total = byteCounts.reduce((a, b) => a + b, 0);
  let medianLog = NaN;
  for (let b = 1, acc = 0; b < 256; b++) {
    acc += byteCounts[b];
    if (acc >= total / 2) { medianLog = toLog(b); break; }
  }
  const hist = {
    linear: histogram(0, 5, 80, (v) => 10 ** v),
    log: histogram(logMin, logMax, 60, (v) => v),
    median: 10 ** medianLog,
  };

  // latitude x month: 2-degree bands (4 rows), geometric mean of cells with data
  const bands = [];
  for (let r0 = 0; r0 < H; r0 += 4) {
    const z = Array.from({ length: 12 }, (_, m) => {
      let sum = 0, n = 0;
      for (let r = r0; r < r0 + 4; r++)
        for (let c = 0; c < W; c++) {
          const v = clim[m * N + r * W + c];
          if (!Number.isNaN(v)) { sum += v; n++; }
        }
      return n >= 20 ? sum / n : NaN;
    });
    const ok = z.filter((v) => !Number.isNaN(v));
    const mean = ok.reduce((a, b) => a + b, 0) / ok.length;
    const rel = z.map((v) => (ok.length >= MIN_MONTHS && !Number.isNaN(v) ? (v - mean) * Math.log2(10) : NaN));
    bands.push({ latTop: 90 - CELL * r0, latBottom: 90 - CELL * (r0 + 4), z, rel });
  }

  // seasonal cycle of each named region (area-weighted geometric mean)
  const regionCycles = Object.entries(meta.regions).map(([name, box]) => ({
    name,
    values: Array.from({ length: 12 }, (_, m) => regionMean(clim, m, box)),
  }));

  return { clim, annual, amp, peak, hist, bands, regionCycles };
}

function regionMean(clim, m, { lon, lat }) {
  let sum = 0, wsum = 0;
  for (let r = 0; r < H; r++) {
    if (LATS[r] < lat[0] || LATS[r] >= lat[1]) continue;
    for (let c = 0; c < W; c++) {
      if (LONS[c] < lon[0] || LONS[c] >= lon[1]) continue;
      const v = clim[m * N + r * W + c];
      if (!Number.isNaN(v)) { sum += v * WEIGHT[r]; wsum += WEIGHT[r]; }
    }
  }
  return wsum > 0 ? sum / wsum : null;
}
