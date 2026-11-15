import { useRef } from 'react';

export default function Controls({
  notes,
  volume,
  onVolume,
  onPlay,
  onPrevious,
  onNext,
  onLegend,
  onExplain,
  onStop,
  onLoadFile,
  onDownload,
  renderingWav,
}) {
  const fileRef = useRef(null);
  const empty = notes.length === 0;

  function handleFile(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (file) onLoadFile(file);
  }

  return (
    <section className="panel controls-panel" aria-labelledby="controls-title">
      <h2 id="controls-title" className="sr-only">Playback controls</h2>

      <div className="controls">
        <div className="controls-main">
          <div className="transport">
            <button type="button" className="btn btn--primary" onClick={onPlay} disabled={empty} aria-keyshortcuts="Space">
              Play piece <kbd aria-hidden="true">Space</kbd>
            </button>
            <button type="button" className="btn" onClick={onPrevious} disabled={empty} aria-keyshortcuts="ArrowLeft">
              ← Previous
            </button>
            <button type="button" className="btn" onClick={onNext} disabled={empty} aria-keyshortcuts="ArrowRight">
              Next →
            </button>
            <button type="button" className="btn" onClick={onLegend} aria-keyshortcuts="L">
              Legend <kbd aria-hidden="true">L</kbd>
            </button>
            <button type="button" className="btn" onClick={onExplain} aria-keyshortcuts="E">
              Explain <kbd aria-hidden="true">E</kbd>
            </button>
            <button type="button" className="btn" onClick={onStop} aria-keyshortcuts="S">
              Stop <kbd aria-hidden="true">S</kbd>
            </button>
          </div>

          <div className="file-row">
            <button type="button" className="btn btn--small" onClick={() => fileRef.current?.click()}>
              Load JSON
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFile}
              hidden
              aria-label="Load a JSON file"
            />
            <button
              type="button"
              className="btn btn--small"
              onClick={onDownload}
              disabled={empty || renderingWav}
            >
              {renderingWav ? 'Rendering WAV…' : 'Download WAV'}
            </button>
          </div>

          <p className="hint">
            Nothing plays until you press Play. Load a JSON file with a <code>regions</code> array;
            the WAV renders the whole piece without playing it out loud.
          </p>
        </div>

        <div className="volume-box">
          <label className="label" htmlFor="volume">Volume</label>
          <div className="volume-row">
            <input
              id="volume"
              type="range"
              min="0"
              max="100"
              step="1"
              value={volume}
              onChange={(event) => onVolume(Number(event.target.value))}
              aria-valuetext={`${volume} percent`}
              aria-describedby="volume-hint"
            />
            <span className="volume-value" aria-hidden="true">{volume}%</span>
          </div>
          <p className="hint" id="volume-hint">Start at low volume and raise it slowly.</p>
        </div>
      </div>
    </section>
  );
}
