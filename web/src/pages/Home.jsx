import { Link } from "react-router-dom";

const TEAM = [
  { name: "Vedika Goyal", role: "" },
  { name: "Gabriel Perez", role: "" },
  { name: "Mark Bishoff", role: "" },
  { name: "Gian Robles", role: "" },
];

const FACTS = [
  { value: "MODIS-Aqua", label: "NASA satellite sensor" },
  { value: "7,305", label: "daily global images" },
  { value: "2003–2022", label: "years averaged" },
  { value: "0.5°", label: "grid, about 55 km" },
];

const initials = (name) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export default function Home() {
  return (
    <>
      <section className="hero">
        <p className="kicker">DSC 106 · Project 3 · NASA MODIS ocean color</p>
        <h1>The Ocean's Green Pulse</h1>
        <p className="question">
          When does the ocean's chlorophyll bloom, and why does each region
          bloom at a different time of year?
        </p>
        <ul className="facts">
          {FACTS.map((f) => (
            <li key={f.label}>
              <strong>{f.value}</strong>
              <span>{f.label}</span>
            </li>
          ))}
        </ul>
        <div className="cta">
          <Link className="button" to="/visualization">
            Explore the map
          </Link>
          <Link className="button ghost" to="/supporting">
            See the supporting graphs
          </Link>
        </div>
      </section>

      <section className="prose">
        <h2>About the project</h2>
        <p>
          The ocean is full of tiny, plant-like living things called
          phytoplankton. Each one is too small to see, but there are so many of
          them that they make about half of the oxygen we breathe, and they are
          the first link in the ocean's food chain. Like plants on land, they
          use a green pigment called chlorophyll to turn sunlight into food.
          When lots of them grow at the same time, the water turns a little
          greener, and we call that a bloom.
        </p>
        <p>
          Our project asks a simple question: when does the ocean bloom, and why
          do different parts of the ocean bloom at different times of year? To
          answer it, we turned 20 years of satellite pictures into maps and
          charts you can play with. You can watch the ocean change color through
          an average year, compare different places side by side, and find the
          month when each part of the ocean is at its greenest.
        </p>

        <h2>The dataset</h2>
        <p>
          Our data comes from NASA. A satellite called Aqua circles the Earth
          every day carrying an instrument called MODIS, which measures the
          color of the ocean. From that color, NASA works out how much
          chlorophyll is in the water. NASA shares this through a service called
          GIBS as pictures, where each color stands for an amount of
          chlorophyll. We downloaded one picture of the whole world for every
          day from 2003 to 2022 (7,305 pictures), used NASA's color key to turn
          each pixel back into a number, and averaged the days into monthly
          maps. We left out 2023 and 2024 because the satellite's orbit has
          slowly been drifting, which makes the newest readings less
          trustworthy.
        </p>
      </section>

      <section>
        <h2>Team</h2>
        <ul className="team">
          {TEAM.map((m) => (
            <li key={m.name} className="card">
              <span className="avatar" aria-hidden="true">
                {initials(m.name)}
              </span>
              <div>
                <strong>{m.name}</strong>
                {m.role && <span className="muted">{m.role}</span>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
