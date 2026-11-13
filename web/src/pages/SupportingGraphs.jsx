import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "../data/load.js";
import Distribution from "../charts/Distribution.jsx";
import RegionalSeries from "../charts/RegionalSeries.jsx";
import AnomalyMaps from "../charts/AnomalyMaps.jsx";
import LatitudeMonth from "../charts/LatitudeMonth.jsx";
import RegionCycles from "../charts/RegionCycles.jsx";

// Each `note` says how the data behind the graph was transformed (the rubric asks
// for that next to the plot). `analysis` is what the graph shows, one string per paragraph.
const GRAPHS = [
  {
    id: "distribution",
    title: "Why a log scale?",
    subtitle: "The same values on a linear and a log axis",
    Chart: Distribution,
    note: "All ocean cell-months of the climatology, weighted by cell area (cos latitude).",
    analysis: [
      "Most of the ocean has very little chlorophyll, but a few places have a lot. On a normal number line (left), almost all the values get squished into a few tall bars near zero, so you can't see the differences between them. On a log scale (right), each step is ten times bigger than the one before (0.01, 0.1, 1, 10), which spreads the values out into a hill shape. The middle value is about 0.12 milligrams of chlorophyll in each cubic meter of water.",
      "This is why every chart on our site uses a log scale, and why we average our numbers in a way that suits this kind of data, so a few very green spots don't drown out everything else.",
    ],
  },
  {
    id: "time-series",
    title: "Seasons vs. years",
    subtitle:
      "At high latitudes the seasons dominate; at the equator, El Niño years stand out",
    Chart: RegionalSeries,
    note: "Monthly composites, area-weighted geometric mean over each region box (North Atlantic 45–60°N 40–15°W; Southern Ocean 45–60°S 50°W–0°; Equatorial Pacific 3°S–3°N 140–100°W). Shaded: El Niño episodes (NOAA ONI). Hover anywhere to compare all three regions in the same month.",
    analysis: [
      "These lines follow three places for 20 years. In the North Atlantic, chlorophyll rises and falls every single year, with a big peak in late spring and summer. The Southern Ocean does the same thing, but its peaks come around December, half a year later, because summer in the south happens while it is winter in the north.",
      "Near the equator in the Pacific, the line stays fairly flat, because there are no big seasons there. Its biggest changes come in El Niño years (the gray bars), when the water near the equator warms up and chlorophyll drops, like in 2015 and 2016. So far from the equator the seasons matter most, but at the equator, El Niño matters most.",
    ],
  },
  {
    id: "anomaly",
    title: "This month vs. the usual",
    subtitle: "The two hemispheres are six months out of phase",
    Chart: AnomalyMaps,
    note: "Monthly climatology divided by each cell's own geometric annual mean (cells with ≥ 6 months of data). Blank = no reliable data that month (cloud, ice, or sun too low).",
    analysis: [
      "These four maps compare each month to what is normal for that spot. Green means more chlorophyll than usual, and brown means less. In June, the waters far to the north turn green. In December, it's the waters around Antarctica that turn green instead.",
      "The warm middle parts of the oceans do the opposite: they get a little greener during their own winter. So the two halves of the Earth take turns, about six months apart. Hover over any spot to see its value in all four months at once.",
    ],
  },
  {
    id: "latitude-month",
    title: "Latitude by month",
    subtitle: "Average chlorophyll of each latitude band, month by month",
    Chart: LatitudeMonth,
    note: "2° latitude bands, geometric mean over ocean cells with data (bands with fewer than 20 cells left blank).",
    analysis: [
      "This chart squeezes the whole world into one picture. Each row is a band of latitude (how far north or south you are), and each column is a month. On the left, the brightest greens show that the far north is greenest from about May to August, while the far south is greenest from about November to February.",
      "The right side compares each band to its own average. It looks almost like a mirror image across the equator: when one half of the world is having its bloom, the other half is quiet. The empty areas near the top and bottom are places where it is too dark in winter for the satellite to see.",
    ],
  },
  {
    id: "region-cycles",
    title: "Five contrasting regions",
    subtitle:
      "Seasonal cycle, in absolute terms and relative to each region's own average",
    Chart: RegionCycles,
    note: "Monthly climatology, area-weighted geometric mean over each region box. Hover a line or legend entry to highlight it; click to keep it selected, and click again to clear.",
    analysis: [
      "Here we compare five very different places. The North Atlantic grows from about 0.16 in January to 0.44 in June, while the Southern Ocean does the opposite and peaks in December. The Arabian Sea is special: it blooms twice a year, around February and again around September, because the monsoon winds switch direction and stir up the water each time. The equatorial Pacific barely changes, and the North Pacific Gyre has about ten times less chlorophyll than the others all year long.",
      "Why do these places bloom at different times? Plankton need two things: sunlight, and nutrients (their food) that are stirred up from deep water. In winter, storms stir up plenty of nutrients, but there isn't much sunlight. In spring, the sunlight comes back while the nutrients are still there, so the plankton bloom. In calm, warm waters like the North Pacific Gyre, the nutrients stay trapped deep down, so it stays a desert.",
    ],
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
              onClick={() =>
                document
                  .getElementById(g.id)
                  ?.scrollIntoView({ behavior: "smooth" })
              }
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

export default function SupportingGraphs() {
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
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 4;
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
          <h1>Supporting Graphs</h1>
          <p>
            Before building <Link to="/visualization">our main map</Link>, we
            made a lot of graphs to get to know the data. These five taught us
            the most. Together they show that the ocean doesn't bloom all at
            once: each part of the ocean has its own season, and the northern
            and southern halves of the world bloom about six months apart. That
            is what led us to our question about when and why the ocean blooms.
            Use the list to jump to any graph.
          </p>
        </section>

        {state.status === "loading" && (
          <p className="status">Loading 20 years of satellite data…</p>
        )}
        {state.status === "error" && (
          <p className="status error">
            Couldn't load the data: {String(state.error.message ?? state.error)}
          </p>
        )}

        {state.status === "ready" &&
          GRAPHS.map(({ id, title, subtitle, Chart, note, analysis }, i) => (
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
                <h3>What it shows</h3>
                {analysis.map((text, k) => (
                  <p key={k}>{text}</p>
                ))}
              </div>
            </article>
          ))}
      </div>
    </div>
  );
}
