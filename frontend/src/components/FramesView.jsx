const FRAMES = [
  {
    year: '2012',
    file: 'night-2012.png',
    alt: 'NASA night-lights frame for 2012. Bright clusters mark cities, industry, and gas flares.',
  },
  {
    year: '2023',
    file: 'night-2023.png',
    alt: 'NASA night-lights frame for 2023, with bright clusters in the same locations for comparison.',
  },
];

function activeCell(note, rows, cols) {
  if (!note) return -1;
  if (!Number.isInteger(note.row) || !Number.isInteger(note.col)) return -1;
  if (note.row < 0 || note.col < 0 || note.row >= rows || note.col >= cols) return -1;
  return note.row * cols + note.col;
}

export default function FramesView({ notes, rows = 16, cols = 16, selected = -1 }) {
  const note = notes[selected] || null;
  const active = activeCell(note, rows, cols);
  const count = rows * cols;
  const canGrid = Number.isInteger(rows) && Number.isInteger(cols) && rows > 0 && cols > 0 && count <= 4096;

  const gridDescription = `${cols} by ${rows} grid of ${count} cells`;

  return (
    <div>
      <div className="frames">
        {FRAMES.map((frame) => (
          <figure className="frame-card" key={frame.year}>
            <div className="frame-media">
              <img
                src={`${import.meta.env.BASE_URL}assets/${frame.file}`}
                alt={`${frame.alt} ${gridDescription}.`}
                loading="lazy"
                decoding="async"
              />
              {canGrid ? (
                <div
                  className="frame-grid"
                  aria-hidden="true"
                  style={{
                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                    gridTemplateRows: `repeat(${rows}, 1fr)`,
                  }}
                >
                  {Array.from({ length: count }, (_, index) => (
                    <span key={index} className={index === active ? 'is-active' : undefined} />
                  ))}
                </div>
              ) : null}
            </div>
            <figcaption className="frame-cap">
              <span>{frame.year}</span>
              <span>{cols} × {rows} grid</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="frame-note">
        The thick outline marks the selected region. The image frames are a visual reference;
        the region list below is the complete description.
      </p>
    </div>
  );
}
