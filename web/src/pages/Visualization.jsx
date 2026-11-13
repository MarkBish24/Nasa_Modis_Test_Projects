import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "../data/load.js";
import BloomMap, { ALL_YEAR } from "../charts/BloomMap.jsx";

// Guided stops: each sets the map's view and month, outlines a region, and
// explains in two or three sentences what to look at and why it happens.
// Region boxes match the ones in data/meta.json.
const STORIES = [
  {
    id: "atlantic",
    title: "The North Atlantic spring bloom",
    view: "chl",
    month: 4,
    boxes: [{ lon: [-40, -15], lat: [45, 60], label: "North Atlantic" }],
    text: "In winter, storms stir up nutrients from deep water, but there isn't enough sunlight for plankton to use them. When the days get longer in spring, the plankton take off, and the North Atlantic turns green from April to June. Press play to watch it happen.",
  },
  {
    id: "south",
    title: "The south blooms six months later",
    view: "calendar",
    month: 11,
    boxes: [{ lon: [-50, 0], lat: [-60, -45], label: "Southern Ocean" }],
    text: "Seasons are flipped in the southern half of the world, so the Southern Ocean's spring and summer come around November to January. The colored band around Antarctica is every place whose bloom peaks in December, half a year after the North Atlantic.",
  },
  {
    id: "winter",
    title: "Warm oceans bloom in winter",
    view: "calendar",
    month: 0,
    boxes: [],
    text: "The warm middle of each ocean does the opposite. It has plenty of sunlight all year but not enough nutrients, so its small bloom comes in winter, when cooler, stormier weather finally mixes some nutrients up. In January, that's the wide bands across the northern Atlantic and Pacific.",
  },
  {
    id: "arabian",
    title: "The Arabian Sea blooms twice",
    view: "calendar",
    month: 8,
    boxes: [{ lon: [55, 70], lat: [10, 22], label: "Arabian Sea" }],
    text: "Twice a year, monsoon winds blow hard across the Arabian Sea: from the southwest in summer and from the northeast in winter. Each time, they stir up the water, so parts of the sea bloom around September and others around February. Click Feb and Sep to compare.",
  },
  {
    id: "deserts",
    title: "Ocean deserts",
    view: "chl",
    month: ALL_YEAR,
    boxes: [{ lon: [-160, -140], lat: [18, 28], label: "North Pacific Gyre" }],
    text: "The dark blue patches in the middle of each ocean have the least chlorophyll on Earth. The water there is warm and calm, so the nutrients stay trapped deep down where there's no sunlight. The North Pacific Gyre has about ten times less chlorophyll than the North Atlantic, all year long.",
  },
];

export default function Visualization() {
  const state = useData();
  const [view, setView] = useState("chl");
  const [month, setMonth] = useState(ALL_YEAR);
  const [storyId, setStoryId] = useState(null);
  const story = STORIES.find((s) => s.id === storyId);

  const onChange = useCallback((next) => {
    if (next.view !== undefined) setView(next.view);
    if (next.month !== undefined) setMonth(next.month);
  }, []);

  const openStory = (s) => {
    if (s.id === storyId) return setStoryId(null); // clicking the open story closes it
    setStoryId(s.id);
    setView(s.view);
    setMonth(s.month);
  };

  return (
    <div className="viz-page">
      <section className="page-intro">
        <h1>When does the ocean bloom?</h1>
        <p>
          Each part of the ocean has its own bloom season. Switch between the amount of chlorophyll and the
          bloom calendar, pick a month, or press play to move through an average year (2003–2022). Hover over the
          map to see the numbers for any spot. New here? Start with one of the stops below.
        </p>
      </section>

      <div className="stories" role="group" aria-label="Guided stops">
        {STORIES.map((s, i) => (
          <button key={s.id} className={s.id === storyId ? "active" : ""} aria-pressed={s.id === storyId}
            onClick={() => openStory(s)}>
            <span className="story-num">{i + 1}</span>{s.title}
          </button>
        ))}
      </div>
      {story && (
        <div className="story-card" aria-live="polite">
          <strong>{story.title}</strong>
          <p>{story.text}</p>
          <button className="story-close" onClick={() => setStoryId(null)} aria-label="Close this stop">×</button>
        </div>
      )}

      {state.status === "loading" && <p className="status">Loading 20 years of satellite data…</p>}
      {state.status === "error" && <p className="status error">Couldn't load the data: {String(state.error.message ?? state.error)}</p>}
      {state.status === "ready" && (
        <div className="card viz-card">
          <BloomMap data={state.data} view={view} month={month} boxes={story?.boxes} onChange={onChange}
            pauseKey={storyId} />
          <p className="graph-note">
            Each month is the average of that month over 2003–2022 (geometric mean, 0.5° grid). Blank areas had no
            reliable data that month (clouds, sea ice, or the sun too low), which is why the poles come and go with the
            seasons. Bloom calendar: the month with the most chlorophyll, smoothed over about 2.5° so nearby spots are
            grouped together; gray means the amount changes less than 1.5× during the year.
          </p>
        </div>
      )}

      <p className="viz-more">
        Want to see how we got here? <Link to="/supporting">The supporting graphs</Link> break these patterns down
        region by region.
      </p>
    </div>
  );
}
