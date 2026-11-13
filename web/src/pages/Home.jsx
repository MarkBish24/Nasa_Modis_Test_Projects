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
          The ocean is filled with these tiny, plant-like organisms called
          phytoplankton, which are microscopically small and difficult to see.
          However, there are so many of them around the world that they make up
          about half of the oxygen we breathe. When lots of them grow at the
          same time, the water's hue turns a little greener; that is to say,
          they bloom.
        </p>
        <p>
          Our project focuses on when the ocean blooms and why different parts
          of the ocean bloom at different times of the year. So, we took 20
          years of satellite imagery and converted it into maps and charts that
          you can interact with to better watch and understand the changes in
          chlorophyll throughout the years and see which parts of the ocean
          bloom the most
        </p>

        <h2>The dataset</h2>
        <p>
          The data comes from one of NASA's satellites, named Aqua, which
          circles the globe every day with an instrument called MODIS that
          measures the color of the ocean. Using the data from the satellite,
          NASA determines how much chlorophyll is in the water based on the
          color of the image. We downloaded one picture of the whole world for
          every day from 2003 to 2022, which totals 7,305 pictures, converted
          each image into a number, and averaged the daily data into monthly
          maps.
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
