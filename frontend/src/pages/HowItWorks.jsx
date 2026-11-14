import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';

const MAPPING = [
  {
    source: 'Size of the change',
    target: 'Pitch',
    detail: 'The largest playable change gets the top note. Every other region is scaled against it.',
  },
  {
    source: 'An increase',
    target: 'A bright, short note',
    detail: 'Triangle wave, 10 ms attack, 0.8 s. Amber in the interface.',
  },
  {
    source: 'A decrease',
    target: 'A dark, slow note',
    detail: 'Sine wave, 120 ms attack, 1.2 s, shifted down one full octave. Cyan in the interface.',
  },
  {
    source: 'Column',
    target: 'Stereo position',
    detail: 'West-to-east becomes left-to-right, using 90% of the stereo field.',
  },
  {
    source: 'Rank',
    target: 'Order in time',
    detail: 'Largest change first, one note every 0.8 seconds, in a piece capped at 30 seconds.',
  },
  {
    source: 'A stable region',
    target: 'Silence',
    detail: 'Regions labelled stable are left out. So are regions without a usable signed change.',
  },
];

export default function HowItWorks() {
  return (
    <div className="page">
      <PageHeader
        title="How it works"
        lede="Two NASA night-lights frames become a short piece of music. The size of a change becomes pitch, its column becomes stereo position, and the largest changes play first. Here is exactly what each sound stands for, and what it does not."
      />

      <div className="page-body prose">
        <section className="page-section" aria-labelledby="data">
          <h2 id="data">The data</h2>
          <p>
            The source is NASA's Earth Information Center visualization{' '}
            <em>Change in Night Lights between 2012 and 2023</em>. The visualization puts two
            global night-lights frames side by side (or one after the other, depending on the
            version) so changes in artificial light are visible.
          </p>
          <p>
            This project reads a small JSON result file derived from that visualization. It does
            not run computer vision in the browser, and it does not measure the images again. The
            default file describes a 16 × 16 grid with 256 regions: 32 are playable (30 increases
            and 2 decreases) and 224 are marked stable.
          </p>
          <div className="callout callout--warn">
            <p>
              <strong>These are relative values.</strong> <code>signed_change</code> is a score
              from the upstream analysis, not radiance in W/m²·sr⁻¹. The app divides each score by
              the largest playable score in the file, so the same note can represent a different
              physical change in a different dataset.
            </p>
          </div>
          <p>
            The upstream analysis is outside this front end. If you want to know how the regions
            were detected, inspect the source data pipeline, not the player. The player treats the
            file as the truth and never invents a value.
          </p>
        </section>

        <section className="page-section" aria-labelledby="mapping">
          <h2 id="mapping">The mapping</h2>
          <div className="table-wrap">
            <table className="mapping-table">
              <caption>One row per design decision. The mapping is fixed for every data file.</caption>
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Sound</th>
                  <th scope="col">Detail</th>
                </tr>
              </thead>
              <tbody>
                {MAPPING.map((row) => (
                  <tr key={row.source}>
                    <th scope="row">{row.source}</th>
                    <td>{row.target}</td>
                    <td>{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3>Relative size</h3>
          <p>
            For every playable region, the engine takes the absolute value of{' '}
            <code>signed_change</code> and divides it by the largest absolute value among the
            playable regions. The result is clamped to 0–1. That number is called{' '}
            <strong>magnitude</strong>, and it picks the pitch.
          </p>

          <h3>The scale</h3>
          <p>
            The scale is D minor pentatonic across two octaves: <strong>D4, F4, G4, A4, C5, D5,
            F5, G5, A5, C6, D6</strong>. Bigger change means a higher note. The lowest increase is
            D4; the highest is D6.
          </p>
          <p>
            A decrease is shifted down a full octave after the scale step is chosen. A small
            decrease is D3; the largest decrease is D5. That is why a decrease sounds lower than an
            increase of the same size, not just darker.
          </p>

          <h3>Stereo position</h3>
          <p>
            The column sets the pan. Column 0 is far left, column 15 is far right, and the middle
            columns sit near the centre. The engine uses 90% of the stereo field, so edge notes are
            clearly side-placed but not hard-panned. The region list on Listen spells out the exact
            side and percentage for every note.
          </p>

          <h3>Change labels</h3>
          <p>
            The interface also labels each magnitude as a <strong>small change</strong> (up to about
            one third), a <strong>medium change</strong> (up to about two thirds), or a{' '}
            <strong>large change</strong> (above that). The labels are descriptive, not scientific
            classifications.
          </p>
        </section>

        <section className="page-section" aria-labelledby="piece">
          <h2 id="piece">The piece</h2>
          <p>
            Regions are sorted by magnitude, largest first. Ties keep the order they had in the
            file, so the same file always produces the same piece. A note starts every{' '}
            <strong>0.8 seconds</strong>. The longest voice lasts 1.2 seconds, so the tails overlap
            and the piece sounds legato rather than like a list of beeps.
          </p>
          <p>
            The schedule is capped at <strong>30 seconds</strong>. That leaves room for at most{' '}
            <strong>36 notes</strong>. The default file has 32 playable regions, so every one of
            them fits. If you load a larger file, the piece plays the largest changes and leaves
            the rest out; the interface reports how many were left out when it finishes.
          </p>
          <p>
            Stable regions are skipped. A region with a missing or non-finite{' '}
            <code>signed_change</code> is also skipped, and so is an unlabeled region whose change
            is exactly 0. The skipped count is the file's region count minus the playable count, so
            it covers all three cases and can be larger than the number of stable regions.
          </p>
          <div className="callout">
            <p>
              <strong>Why a stable region is skipped even when its score is not zero:</strong> the
              file's <code>direction</code> field says <code>stable</code>. The player respects
              that label instead of guessing from the sign. Stability is a property of the upstream
              comparison, not the same thing as a change of exactly 0.
            </p>
          </div>

          <h3>Sound design</h3>
          <p>
            Increases use a triangle wave with a 10 ms attack and a 0.8 s duration. Decreases use a
            sine wave with a 120 ms attack and a 1.2 s duration. A light room reverb (18% wet, 1.6 s)
            and a compressor sit on the master bus. Low notes get a small loudness lift so they do
            not disappear next to high ones.
          </p>
          <p>
            Volume is a single master control from 0% to 100%, starting at 30% every time the page
            loads. The size of a change is pitch, not volume. Stop fades the current bus in 40 ms,
            then starts a fresh one for the next sound.
          </p>
        </section>

        <section className="page-section" aria-labelledby="listen-for">
          <h2 id="listen-for">What to listen for</h2>
          <p>
            Press <kbd>L</kbd> for the legend. It plays four sounds in order: a steady no-change
            reference, a small increase, a large increase, and a large decrease. The same pitches
            are used in the piece, so the legend is a real calibration, not a different sound set.
          </p>
          <ul>
            <li>
              <strong>Amber, rising, short:</strong> an increase. The higher it is, the larger the
              relative change.
            </li>
            <li>
              <strong>Cyan, falling, slow:</strong> a decrease. The farther down it sits, the
              larger the relative change.
            </li>
            <li>
              <strong>Left or right:</strong> the region's column. The region list gives the exact
              pan for every note.
            </li>
            <li>
              <strong>Earlier:</strong> a larger change. The piece never shuffles the ranking.
            </li>
          </ul>
        </section>

        <section className="page-section" aria-labelledby="limits">
          <h2 id="limits">What this does not tell you</h2>
          <ul>
            <li>
              It is not a measure of emissions, electricity use, population, or economic activity.
              Night-lights change can have many causes, including growth, outages, war, migration,
              and gas flaring.
            </li>
            <li>
              It is not a continuous time series. The visualization compares two frames, so the
              music cannot show what happened in between.
            </li>
            <li>
              It does not know place names. Row and column are the only location the player has;
              the visualization itself is the geographic reference.
            </li>
            <li>
              It is not a scientific instrument. Two regions with the same relative score get the
              same note even if their physical changes are very different.
            </li>
            <li>
              The default file is a sample of the grid, not a global ranking. It is meant to make
              the sonification idea audible and inspectable.
            </li>
            <li>
              The 30-second cap is a musical choice. A larger file is truncated, not summarised;
              the interface tells you how many regions were left out.
            </li>
          </ul>
          <p>
            The image frames are a visual reference. The region list and the now-playing sentence
            carry the same information in text, so the 3D view is never required to understand the
            piece.
          </p>
        </section>

        <p className="next-step">
          <Link className="btn btn--primary" to="/">Listen to the piece</Link>{' '}
          <Link className="btn" to="/docs">Read the data format</Link>{' '}
          <Link className="btn" to="/accessibility">Accessibility features</Link>
        </p>
      </div>
    </div>
  );
}
