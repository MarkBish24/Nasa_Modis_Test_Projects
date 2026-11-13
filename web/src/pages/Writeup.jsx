import Placeholder from "../components/Placeholder.jsx";

// Sections follow the Project 3 rubric: motivation, design rationale (encodings,
// transformations, color, interaction, alternatives) and development process.
// The two <Placeholder> blocks hold facts only the team knows (roles, hours).
export default function Writeup() {
  return (
    <article className="prose">
      <h1>Write-up</h1>

      <h2>Motivation</h2>
      <p>
        Tiny ocean plankton make about half of the oxygen on Earth and feed
        almost everything else in the sea, from small fish all the way up to
        whales. A single map of the "average" ocean shows where plankton live,
        but it hides something important: timing. Two places can have the same
        average amount of plankton and still bloom at completely different times
        of year. We wanted to build something that lets anyone see when and
        where the ocean blooms, and start to understand why.
      </p>

      <h2>Data and transformations</h2>
      <p>
        NASA shares its ocean data as pictures, where each pixel represents one
        of 255 colors, with a key that shows the average chlorophyll level for
        each color. We downloaded a picture of the whole world every day from
        2003 to 2022, then used the color key to convert each pixel into a
        number. Pixels that were see-through because of clouds, sea ice, or
        darkness were counted as missing. There were about 7,000 pictures in
        total, each with an image size of 720 by 360 pixels, and each pixel
        covers an average area of 55 km by 55 km. Then, we averaged the daily
        pictures into one map for each month, so each January was added
        together, then each February, and so on, to get the average year.
      </p>

      <h2>Design rationale</h2>
      <h3>Marks and encodings</h3>
      <p>
        Chlorophyll changes smoothly across the ocean, so we drew our maps as a
        grid of tiny colored squares, one for each spot, instead of coloring
        whole regions. We used a flat map because it matches the grid of our
        data exactly and shows the whole world at once, so you can compare north
        and south. For changes over time, we used line charts, because lines
        make it easy to see values go up and down and to compare the timing of
        different places. The latitude-by-month chart is a grid where each row
        is a band of latitude and each column is a month, so the seasons of the
        whole world fit into one picture.
      </p>
      <h3>Color</h3>
      <p>
        For the amount of chlorophyll, our colors range from dark blue (very
        little chlorophyll) through teal and green to pale yellow (high amounts
        of chlorophyll). We chose these colors because they are aesthetically
        pleasing and follow what water actually looks like with and without
        chlorophyll: clear water is a deep blue, while water full of chlorophyll
        is green. Brighter colors also always mean there is more chlorophyll, so
        the scale can still be used by people who are colorblind. For the Bloom
        Calendar, we used a color wheel to represent each month's peak
        chlorophyll levels, or where chlorophyll peaked the most throughout the
        year. Spots that are gray represent areas where the peaks are not
        significant enough for those months, so they are left gray. We also
        separated each map's peaks by month so it would be easier to read and
        find patterns.
      </p>
      <h3>Interaction</h3>
      <p>
        Our main map has two views that share one month bar. In the Chlorophyll
        view, you can pick a month or press play to watch the green move across
        the world with the seasons. In the Bloom Calendar view, picking a month
        shows only the places that bloom in that month, so pressing play makes
        the bloom sweep around the world. This allows users to easily see the
        monthly changes in where chlorophyll is blooming the most. The cycling
        chart also makes it easier to look at a holistic view of global
        chlorophyll levels for that month, as well as its peak.
      </p>
      <p>
        The supporting graphs have smaller interactions that allow you to see
        different kinds of information, such as the reasoning behind different
        patterns and uses, and compare places more directly instead of just
        viewing sections by color. For example, in the Seasons vs. Years graph,
        you can compare the peaks and valleys using a small line tool. For the
        Month vs. Usual graph, you can use a tooltip that highlights an area in
        each region. Finally, in the Five Contrasting Regions graph, you can
        select different line charts and compare their seasonal changes.
      </p>
      <h3>Alternatives we considered</h3>
      <p>
        At first, we made a series of different graphs and had to choose from
        several different ideas. We had line charts, bar charts, violin plots,
        and so forth, but we felt that the main graph should be a world map, and
        we wanted to include all the other charts we had made as supporting
        graphs. At first, the timelapse and the bloom calendar were two separate
        charts. We combined them into one map with one month bar because they
        show the same months on the same map, and together they tell one story.
        We also thought about showing twelve small maps side by side, one for
        each month, but each map ended up too small to see any detail. We also
        thought about a slider through all 240 months from 2003 to 2022, but the
        changes from year to year were small and noisy compared to the seasons,
        so we kept those in the "Seasons vs. years" chart. Our first version of
        the bloom calendar colored every single spot by its own peak month and
        looked messy, so we grouped nearby spots together and turned weak
        seasons gray.
      </p>

      <h2>Development process</h2>
      <h3>Who did what</h3>
      <Placeholder hint="what each person worked on">
        <ul>
          <li>
            <strong>Vedika Goyal:</strong> ___
          </li>
          <li>
            <strong>Gabriel Perez:</strong> ___
          </li>
          <li>
            <strong>Mark Bishoff:</strong> ___
          </li>
          <li>
            <strong>Gian Robles:</strong> ___
          </li>
        </ul>
      </Placeholder>
      <h3>Time spent</h3>
      <Placeholder hint="your real total">
        <p>We spent about ___ people-hours on this project in total.</p>
      </Placeholder>
      <h3>What took the most time</h3>
      <p>
        The hardest part was getting the data. NASA only gives out pictures, so
        we had to download more than 7,000 of them and write code to turn every
        color back into a number. We also ran into a strange problem: near the
        poles in winter, the data showed "blooms" that weren't real. It turned
        out the sun was so low in the sky that the satellite's readings were
        wrong, so we had to figure out how to find and remove those spots.
        Making the maps run smoothly in the browser, especially the timelapse,
        also took a lot of testing.
      </p>

      <h2>Sources</h2>
      <ul>
        <li>
          NASA Global Imagery Browse Services (GIBS), layer{" "}
          <code>MODIS_Aqua_L2_Chlorophyll_A</code> and colormap{" "}
          <code>MODIS_Chlorophyll.xml</code>.
        </li>
        <li>
          Land outlines: Natural Earth via <code>world-atlas</code> (1:50m).
        </li>
        <li>NOAA Oceanic Niño Index, for El Niño episodes.</li>
        <li>
          Built with <a href="https://d3js.org">D3.js</a> v7, React and
          topojson-client.
        </li>
      </ul>
    </article>
  );
}
