import Placeholder from "../components/Placeholder.jsx";

// Sections follow the Project 3 rubric: motivation, design rationale (encodings,
// transformations, color, interaction, alternatives) and development process.
export default function Writeup() {
  return (
    <article className="prose">
      <h1>Write-up</h1>

      <h2>Motivation</h2>
      <Placeholder paragraphs={1} hint="the question and why it is worth asking" />

      <h2>Data and transformations</h2>
      <Placeholder paragraphs={2} hint="colors → numbers, monthly composites, climatology, low-sun mask, log-space averages, cos(latitude) weights" />

      <h2>Design rationale</h2>
      <h3>Marks and encodings</h3>
      <Placeholder paragraphs={1} hint="why a raster map, a latitude × month panel and line charts" />
      <h3>Color</h3>
      <Placeholder paragraphs={1} hint="the log chlorophyll ramp, the diverging ratio scale, the cyclic peak-month wheel" />
      <h3>Interaction</h3>
      <Placeholder paragraphs={1} hint="what each interaction lets the reader discover that a static plot could not" />
      <h3>Alternatives we considered</h3>
      <Placeholder paragraphs={1} hint="other designs and why you didn't choose them" />

      <h2>Development process</h2>
      <h3>Who did what</h3>
      <Placeholder paragraphs={1} hint="how the work was split among team members" />
      <h3>Time spent</h3>
      <Placeholder paragraphs={1} hint="roughly how many people-hours in total" />
      <h3>What took the most time</h3>
      <Placeholder paragraphs={1} hint="the hardest or slowest parts" />

      <h2>Sources</h2>
      <ul>
        <li>NASA Global Imagery Browse Services (GIBS), layer <code>MODIS_Aqua_L2_Chlorophyll_A</code> and colormap <code>MODIS_Chlorophyll.xml</code>.</li>
        <li>Land outlines: Natural Earth via <code>world-atlas</code> (1:50m).</li>
        <li>NOAA Oceanic Niño Index, for El Niño episodes.</li>
        <li>Built with <a href="https://d3js.org">D3.js</a> v7, React and topojson-client.</li>
      </ul>
    </article>
  );
}
