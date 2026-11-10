import { useEffect, useRef, useState } from "react";
import { useData } from "../data/load.js";
import Placeholder from "../components/Placeholder.jsx";
import AnnualMap from "../charts/AnnualMap.jsx";
import Distribution from "../charts/Distribution.jsx";
import RegionalSeries from "../charts/RegionalSeries.jsx";
import AnomalyMaps from "../charts/AnomalyMaps.jsx";
import LatitudeMonth from "../charts/LatitudeMonth.jsx";
import PeakMonthMap from "../charts/PeakMonthMap.jsx";
import RegionCycles from "../charts/RegionCycles.jsx";

// Each `note` says how the data behind the graph was transformed (the rubric asks
// for that next to the plot). `analysis` is what the team still has to write.
const GRAPHS = [
  {
    id: "annual-mean",
    title: "Where is the ocean green?",
    subtitle: "Chlorophyll-a through an average year, 2003–2022 (press play)",
    Chart: AnnualMap,
    note: "Each month is the geometric mean of that calendar month over 2003–2022, per 0.5° cell. Blank = no reliable data that month (cloud, sea ice, or sun too low), which is why the poles appear and disappear with the seasons. Annual average = geometric mean of the 12 months, shown only for cells with at least 6 months of data.",
  },
  {
    id: "distribution",
    title: "Why a log scale?",
    subtitle: "The same values on a linear and a log axis",
    Chart: Distribution,
    note: "All ocean cell-months of the climatology, weighted by cell area (cos latitude).",
  },
  {
    id: "time-series",
    title: "Seasons vs. years",
    subtitle: "At high latitudes the seasons dominate; at the equator, El Niño years stand out",
    Chart: RegionalSeries,
    note: "Monthly composites, area-weighted geometric mean over each region box (North Atlantic 45–60°N 40–15°W; Southern Ocean 45–60°S 50°W–0°; Equatorial Pacific 3°S–3°N 140–100°W). Shaded: El Niño episodes (NOAA ONI). Hover anywhere to compare all three regions in the same month.",
  },
  {
    id: "anomaly",
    title: "This month vs. the usual",
    subtitle: "The two hemispheres are six months out of phase",
    Chart: AnomalyMaps,
    note: "Monthly climatology divided by each cell's own geometric annual mean (cells with ≥ 6 months of data). Blank = no reliable data that month (cloud, ice, or sun too low).",
  },
  {
    id: "latitude-month",
    title: "Latitude by month",
    subtitle: "Average chlorophyll of each latitude band, month by month",
    Chart: LatitudeMonth,
    note: "2° latitude bands, geometric mean over ocean cells with data (bands with fewer than 20 cells left blank).",
  },
  {
    id: "peak-month",
    title: "A calendar of blooms",
    subtitle: "The month when chlorophyll peaks",
    Chart: PeakMonthMap,
    note: "Peak = calendar month with the highest climatological chlorophyll. Colors are smoothed with a 2.5° majority filter (each cell shows the most common peak month around it, stronger seasons weighted more); hover a cell for its own value. Gray = seasonal range (max ÷ min) under 1.5×. Cells with fewer than 6 months of data are blank.",
  },
  {
    id: "region-cycles",
    title: "Five contrasting regions",
    subtitle: "Seasonal cycle, in absolute terms and relative to each region's own average",
    Chart: RegionCycles,
    note: "Monthly climatology, area-weighted geometric mean over each region box. Hover a line or legend entry to highlight it; click to keep it selected, and click again to clear.",
  },
];

/**
 * Jump-to list of the graphs. A sticky sidebar on wide screens, a sticky strip
 * under the header on narrow ones. The graph currently in view is highlighted.
 */
function GraphNav({ active }) {
  const listRef = useRef(null);

  // keep the active pill visible in the horizontal (mobile) strip, without
  // scrolling the page itself
  useEffect(() => {
    const list = listRef.current;
    const btn = list?.querySelector("button.active");
    if (!btn || list.scrollWidth <= list.clientWidth) return;
    const b = btn.getBoundingClientRect();
    const l = list.getBoundingClientRect();
    const center = list.scrollLeft + (b.left - l.left) + b.width / 2;
    list.scrollTo({ left: center - l.width / 2, behavior: "smooth" });
  }, [active]);

  return (
    <nav className="graph-nav" aria-label="Graphs on this page">
      <p className="graph-nav-title">Graphs</p>
      <ol ref={listRef}>
        {GRAPHS.map((g, i) => (
          <li key={g.id}>
            {/* buttons, not #anchors: the URL hash already holds the route (HashRouter) */}
            <button
              className={active === g.id ? "active" : ""}
              aria-current={active === g.id ? "true" : undefined}
              onClick={() => document.getElementById(g.id)?.scrollIntoView({ behavior: "smooth" })}
            >
              <span className="graph-nav-num">{i + 1}</span>
              <span>{g.title}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default function Exploration() {
  const state = useData();
  const [active, setActive] = useState(GRAPHS[0].id);

  // the active graph is the last one whose top has scrolled above a line 35% down
  // the viewport (at the very bottom of the page, the last graph)
  useEffect(() => {
    if (state.status !== "ready") return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.35;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current = GRAPHS[0].id;
      for (const g of GRAPHS) {
        const el = document.getElementById(g.id);
        if (el && el.getBoundingClientRect().top <= line) current = g.id;
      }
      setActive(atBottom ? GRAPHS.at(-1).id : current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [state.status]);

  return (
    <div className="explore-layout">
      <GraphNav active={active} />

      <div className="explore-main">
        <section className="page-intro">
          <h1>Exploration</h1>
          <Placeholder paragraphs={1} hint="how these graphs led you to your question" />
        </section>

        {state.status === "loading" && <p className="status">Loading 20 years of satellite data…</p>}
        {state.status === "error" && <p className="status error">Couldn't load the data: {String(state.error.message ?? state.error)}</p>}

        {state.status === "ready" && GRAPHS.map(({ id, title, subtitle, Chart, note }, i) => (
          <article key={id} id={id} className="graph card">
            <header>
              <span className="graph-number">{i + 1}</span>
              <div>
                <h2>{title}</h2>
                <p className="graph-subtitle">{subtitle}</p>
              </div>
            </header>
            <Chart data={state.data} />
            <p className="graph-note">{note}</p>
            <div className="analysis">
              <h3>Analysis</h3>
              <Placeholder paragraphs={2} hint={`what graph ${i + 1} shows and what you learned from it`} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
