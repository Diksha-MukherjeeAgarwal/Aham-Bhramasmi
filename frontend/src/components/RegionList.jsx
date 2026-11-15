import { engine } from '../engineInstance.js';

function isPlayable(region) {
  const change = Number(region.signed_change);
  if (region.signed_change == null || !Number.isFinite(change)) return false;
  const label = String(region.direction || '').trim().toLowerCase();
  if (label === 'stable') return false;
  if (change === 0) return false;
  return true;
}

function getPlayableIndex(notes, sourceIndex) {
  return notes.findIndex((note) => note.sourceIndex === sourceIndex);
}

export default function RegionList({ notes, allRegions, selected, onSelect, total }) {
  const cells = Number.isInteger(total) && total > 0 ? total : (allRegions.length || notes.length);

  const regionsToShow = allRegions.length > 0 ? allRegions : notes;

  return (
    <section className="section-block regions-block" aria-labelledby="regions-title">
      <div className="section-head">
        <h2 id="regions-title">All 256 grid cells</h2>
        <p>
          {notes.length} playable of {cells} cells. Playable cells can be selected to hear alone.
        </p>
      </div>

      {regionsToShow.length === 0 ? (
        <p>No data loaded.</p>
      ) : (
        <ol className="region-list">
          {regionsToShow.map((region, sourceIndex) => {
            const playable = isPlayable(region);
            const playableIndex = playable ? getPlayableIndex(notes, sourceIndex) : -1;
            const active = playableIndex === selected;
            const direction = playable
              ? (Number(region.signed_change) < 0 ? 'down' : 'up')
              : 'stable';

            return (
              <li key={region.id} className={playable ? '' : 'region-stable'}>
                {playable && playableIndex >= 0 ? (
                  <button
                    type="button"
                    className="region-btn"
                    aria-current={active ? 'true' : undefined}
                    aria-label={engine.describe(notes[playableIndex])}
                    onClick={() => onSelect(playableIndex)}
                  >
                    <span className="region-num" aria-hidden="true">
                      {String(notes[playableIndex].number).padStart(2, '0')}
                    </span>
                    <span className="region-main">
                      <span className="region-title">
                        <span
                          className={direction === 'up' ? 'dir-up' : 'dir-down'}
                          aria-hidden="true"
                        >
                          {direction === 'up' ? '▲' : '▼'}
                        </span>{' '}
                        {direction === 'up' ? 'Increase' : 'Decrease'}, {notes[playableIndex].changeLabel}
                      </span>
                      <span className="region-meta">
                        <span>Row {region.row}, col {region.col}</span>
                        <span>Pitch {notes[playableIndex].pitchName}</span>
                        <span>{notes[playableIndex].frequency.toFixed(1)} Hz</span>
                        <span>Pan {engine.panLabel(notes[playableIndex].pan, false)}</span>
                      </span>
                    </span>
                    {active ? <span className="current-badge">Current</span> : null}
                  </button>
                ) : (
                  <div className="region-btn region-btn--stable" aria-disabled="true">
                    <span className="region-num" aria-hidden="true">
                      {String(region.id).padStart(3, '0')}
                    </span>
                    <span className="region-main">
                      <span className="region-title">
                        <span className="dir-stable" aria-hidden="true">■</span> Stable
                      </span>
                      <span className="region-meta">
                        <span>Row {region.row}, col {region.col}</span>
                        <span>No audible change</span>
                      </span>
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
