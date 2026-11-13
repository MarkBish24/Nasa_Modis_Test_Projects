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
        Tiny ocean plankton make about half of the oxygen on Earth and feed almost everything else in the sea, from
        small fish all the way up to whales. A single map of the "average" ocean shows where plankton live, but it
        hides something important: timing. Two places can have the same average amount of plankton and still bloom
        at completely different times of year. We wanted to build something that lets anyone see when and where the
        ocean blooms, and start to understand why.
      </p>

      <h2>Data and transformations</h2>
      <p>
        NASA shares its ocean color data as pictures, not numbers. Each pixel is one of 255 colors, and NASA
        publishes a key that says how much chlorophyll each color stands for. We downloaded one picture of the
        whole world for every day from 2003 to 2022. That's 7,305 pictures, each 720 by 360 pixels, so every pixel
        covers a square about 55 km wide. Then we used the color key to turn every pixel back into a number. Pixels
        that were see-through, because of clouds, sea ice, land or darkness, counted as missing.
      </p>
      <p>
        Next, we averaged the daily pictures into one map for each month, and then averaged all 20 Januaries
        together, all 20 Februaries, and so on, to get one "average year." Chlorophyll has many tiny values and a
        few huge ones, so we used a geometric mean, a kind of average that works on a log scale and doesn't let a few
        very green spots take over. We only kept a spot if it had data from at least 3 different years. We also
        removed places where the sun was very low in the sky, because there the satellite reads falsely high and
        makes fake winter "blooms." When we averaged over a whole region, we counted spots near the poles a little
        less, because the grid squares get smaller as you go toward the poles. Finally, we left out 2023 and 2024,
        because the satellite's orbit has been drifting and the newest data looked wrong.
      </p>

      <h2>Design rationale</h2>
      <h3>Marks and encodings</h3>
      <p>
        Chlorophyll changes smoothly across the ocean, so we drew our maps as a grid of tiny colored squares, one for
        each spot, instead of coloring whole regions. We used a flat map because it matches the grid of our data
        exactly and shows the whole world at once, so you can compare north and south. For changes over time, we used
        line charts, because lines make it easy to see values go up and down and to compare the timing of different
        places. The latitude-by-month chart is a grid where each row is a band of latitude and each column is a
        month, so the seasons of the whole world fit into one picture.
      </p>
      <h3>Color</h3>
      <p>
        For the amount of chlorophyll, our colors go from dark blue (very little) through teal and green to pale
        yellow (a lot). This matches what the water really looks like: clear water is deep blue and bloom water is
        green. Brighter always means more, so the scale still works for people who are colorblind or if the page is
        printed in black and white. For the "compared to normal" maps, brown means less than usual, light gray means
        normal and green means more than usual, so the middle color clearly means "nothing special." For the bloom
        calendar we used a color wheel, because months go in a circle and December sits right next to January.
        Spots with only a weak season are plain gray, since their "peak month" doesn't mean much.
      </p>
      <h3>Interaction</h3>
      <p>
        Our main map has two views that share one month bar. In the Chlorophyll view, you can pick a month or press
        play to watch the green move across the world with the seasons. In the Bloom calendar view, picking a month
        shows only the places that bloom in that month, so pressing play makes the bloom sweep around the world, from
        the far north in early summer to the waters around Antarctica in December. That is something no single
        picture can show. The month stays the same when you switch views, and hovering over any spot shows both how
        much chlorophyll it has and when it blooms. The five guided stops above the map jump to an interesting view,
        draw a box around the region, and explain in plain words why it blooms when it does.
      </p>
      <p>
        The supporting graphs have smaller interactions. Hovering over the three time-series panels shows the same
        month in all three, so you can compare places directly. Hovering over one of the four month maps puts a box on
        the same spot in all four. On the last chart, clicking a line keeps it highlighted so you can study one region
        at a time.
      </p>
      <h3>Alternatives we considered</h3>
      <p>
        At first, the timelapse and the bloom calendar were two separate charts. We combined them into one map with
        one month bar, because they show the same months on the same map, and together they tell one story. We also
        thought about showing twelve small maps side by side, one for each month, but each map ended up too small
        to see any detail. We also thought about a slider through all 240 months from 2003 to 2022, but the changes
        from year to year were small and noisy compared to the seasons, so we kept those to the "Seasons vs. years"
        chart. We considered a spinning globe, but you can only see half the Earth at a time, which makes it hard to
        compare the north and south. Our first version of the bloom calendar colored every single spot by its own peak
        month, and it looked like confetti, so we grouped nearby spots together and turned weak seasons gray.
      </p>

      <h2>Development process</h2>
      <h3>Who did what</h3>
      <Placeholder hint="what each person worked on">
        <ul>
          <li><strong>Vedika Goyal:</strong> ___</li>
          <li><strong>Gabriel Perez:</strong> ___</li>
          <li><strong>Mark Bishoff:</strong> ___</li>
          <li><strong>Gian Robles:</strong> ___</li>
        </ul>
      </Placeholder>
      <h3>Time spent</h3>
      <Placeholder hint="your real total">
        <p>We spent about ___ people-hours on this project in total.</p>
      </Placeholder>
      <h3>What took the most time</h3>
      <p>
        The hardest part was getting the data. NASA only gives out pictures, so we had to download more than 7,000 of
        them and write code to turn every color back into a number. We also ran into a strange problem: near the
        poles in winter, the data showed "blooms" that weren't real. It turned out the sun was so low in the sky that
        the satellite's readings were wrong, so we had to figure out how to find and remove those spots. Making the
        maps run smoothly in the browser, especially the timelapse, also took a lot of testing.
      </p>

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
