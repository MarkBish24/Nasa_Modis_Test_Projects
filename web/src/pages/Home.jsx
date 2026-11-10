import { Link } from "react-router-dom";
import Placeholder from "../components/Placeholder.jsx";

// TODO(team): replace with real names, roles and links.
const TEAM = [
  { name: "Team member 1", role: "Role (e.g. data pipeline)" },
  { name: "Team member 2", role: "Role (e.g. map and interactions)" },
  { name: "Team member 3", role: "Role (e.g. charts and stories)" },
  { name: "Team member 4", role: "Role (e.g. write-up and testing)" },
];

const FACTS = [
  { value: "MODIS-Aqua", label: "NASA satellite sensor" },
  { value: "7,305", label: "daily global images" },
  { value: "2003–2022", label: "years averaged" },
  { value: "0.5°", label: "grid, about 55 km" },
];

const initials = (name) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export default function Home() {
  return (
    <>
      <section className="hero">
        <p className="kicker">DSC 106 · Project 3 · NASA MODIS ocean color</p>
        <h1>The Ocean's Green Pulse</h1>
        <p className="question">When does the ocean bloom, and why does each region bloom at a different time of year?</p>
        <ul className="facts">
          {FACTS.map((f) => (
            <li key={f.label}><strong>{f.value}</strong><span>{f.label}</span></li>
          ))}
        </ul>
        <div className="cta">
          <Link className="button" to="/exploration">See the graphs</Link>
          <Link className="button ghost" to="/writeup">Read the write-up</Link>
        </div>
      </section>

      <section className="prose">
        <h2>About the project</h2>
        <Placeholder paragraphs={2} hint="what the project is about and why ocean blooms matter" />

        <h2>The dataset</h2>
        <Placeholder paragraphs={1} hint="NASA GIBS layer MODIS_Aqua_L2_Chlorophyll_A, and which parts of it you use" />
      </section>

      <section>
        <h2>Team</h2>
        <ul className="team">
          {TEAM.map((m) => (
            <li key={m.name} className="card">
              <span className="avatar" aria-hidden="true">{initials(m.name)}</span>
              <div>
                <strong>{m.name}</strong>
                <span className="muted">{m.role}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
