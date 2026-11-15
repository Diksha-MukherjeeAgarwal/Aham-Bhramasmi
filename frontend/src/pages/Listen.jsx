import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccessibility } from '../AccessibilityContext.jsx';
import { engine, loadDefaultData } from '../engineInstance.js';
import { useEngine } from '../useEngine.js';
import { EXPLANATION, speakExplanation, stopSpeech } from '../explanation.js';
import Controls from '../components/Controls.jsx';
import NowPlaying from '../components/NowPlaying.jsx';
import RegionList from '../components/RegionList.jsx';
import FramesView from '../components/FramesView.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';

const GlobeView = lazy(() => import('../components/GlobeView.jsx'));

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export default function Listen() {
  const { accessibilityMode, selectedRegion, setSelectedRegion, announce } = useAccessibility();
  const { notes, info, isPlaying, sourceLabel } = useEngine();
  const [volume, setVolume] = useState(() => Math.round(engine.getState().volume * 100));
  const [dataError, setDataError] = useState('');
  const [audioError, setAudioError] = useState('');
  const [wavState, setWavState] = useState('');
  const [playStatus, setPlayStatus] = useState('');
  const [renderingWav, setRenderingWav] = useState(false);
  const [view, setView] = useState(accessibilityMode ? 'frames' : 'globe');
  const [webglMessage, setWebglMessage] = useState('');
  const [allRegions, setAllRegions] = useState([]);
  const lastError = useRef('');
  const howToRef = useRef(null);
  const wasAccessibilityMode = useRef(accessibilityMode);

  const selected = selectedRegion >= 0 && selectedRegion < notes.length
    ? selectedRegion
    : (notes.length ? 0 : -1);
  const activeNote = notes[selected] || null;
  const rows = info?.rows || 16;
  const cols = info?.cols || 16;
  const increases = notes.filter((note) => note.direction === 'up').length;
  const decreases = notes.length - increases;
  const stable = info ? Math.max(0, info.total - notes.length) : 0;
  const plan = notes.length ? engine.planPiece(notes) : { count: 0 };
  const sourceBits = [];
  if (sourceLabel) sourceBits.push(sourceLabel);
  if (info?.dataset) sourceBits.push(info.dataset);
  if (stable) sourceBits.push(`${stable} stable / not played`);
  const sourceText = sourceBits.join(' · ');

  // Fetch raw JSON to get all 256 regions for the region list
  useEffect(() => {
    const url = new URL('data.json', document.baseURI).href;
    fetch(url)
      .then((res) => res.json())
      .then((json) => {
        if (json.regions && Array.isArray(json.regions)) {
          setAllRegions(json.regions);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    engine.setVolume(volume / 100);
  }, [volume]);

  useEffect(() => {
    if (accessibilityMode) setView('frames');
  }, [accessibilityMode]);

  // Moving from normal mode into accessibility mode should land the reader on
  // the instructions, not leave them guessing what to activate next.
  useEffect(() => {
    if (accessibilityMode && !wasAccessibilityMode.current) {
      const frame = requestAnimationFrame(() => howToRef.current?.focus());
      wasAccessibilityMode.current = accessibilityMode;
      return () => cancelAnimationFrame(frame);
    }
    wasAccessibilityMode.current = accessibilityMode;
    return undefined;
  }, [accessibilityMode]);

  useEffect(() => {
    if (!engine.getState().info) void loadDefaultData();
  }, []);

  useEffect(() => {
    const offs = [
      engine.subscribe('error', (error) => {
        lastError.current = error.message || '';
        if (error.kind === 'load' || error.kind === 'data') {
          setDataError(error.message || 'The data could not be loaded.');
        } else if (error.kind === 'audio') {
          // Visible feedback for a blocked or missing audio context. App already
          // announces this through the one polite live region.
          setAudioError(error.message || 'Audio could not start.');
        }
      }),
      engine.subscribe('loaded', () => {
        setDataError('');
        setAudioError('');
        setWavState('');
        setPlayStatus('');
      }),
      engine.subscribe('pieceEnd', (payload) => {
        if (!payload || payload.kind !== 'piece') return;
        // App already announces completion. This copy is visible only, so it
        // stays a plain paragraph and does not become a second live region.
        setPlayStatus(payload.left
          ? `Piece complete: ${payload.played} of ${payload.total} regions played. ${payload.left} left out by the 30-second cap.`
          : `Piece complete: all ${plural(payload.played, 'region')} played.`);
      }),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  function handlePlay() {
    if (!notes.length) return;
    setAudioError('');
    setWavState('');
    setPlayStatus('');
    announce(plan.count < notes.length
      ? `Playing ${plan.count} of ${plural(notes.length, 'region')}, largest first.`
      : `Playing ${plural(plan.count, 'region')}, largest first.`);
    void engine.play();
  }

  function handleStep(direction) {
    setAudioError('');
    const index = direction > 0 ? engine.next() : engine.previous();
    if (Number.isInteger(index) && index >= 0) {
      const state = engine.getState();
      setSelectedRegion(index);
      announce(engine.describe(state.notes[index]));
    }
  }

  function handleRegion(index) {
    setAudioError('');
    setSelectedRegion(index);
    announce(engine.describe(notes[index]));
    void engine.playRegion(index);
  }

  function handleLegend() {
    setAudioError('');
    announce('Playing the legend: no change, a small increase, a large increase, then a decrease.');
    void engine.legend();
  }

  function handleExplain() {
    announce(speakExplanation() ? 'Explanation started.' : EXPLANATION);
  }

  function handleStop() {
    stopSpeech();
    engine.stop();
  }

  async function handleLoadFile(file) {
    lastError.current = '';
    setDataError('');
    setAudioError('');
    const ok = await engine.loadJSON(file, file.name);
    if (ok) {
      const state = engine.getState();
      const skipped = state.info?.skipped
        ? ` ${plural(state.info.skipped, 'region')} skipped.`
        : '';
      announce(`Loaded ${plural(state.notes.length, 'changed region')} from ${file.name}.${skipped}`);
      setWavState('');
    } else {
      setDataError(lastError.current || 'The file could not be loaded. Check that it is valid JSON with a regions array.');
    }
  }

  async function handleDownload() {
    setRenderingWav(true);
    setWavState('Rendering the whole piece as a WAV file…');
    announce('Rendering the whole piece as a WAV file.');
    try {
      const buffer = await engine.render('piece');
      const wav = engine.toWav(buffer);
      const url = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'night-lights-piece.wav';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setWavState('Saved night-lights-piece.wav.');
      announce('Saved night-lights-piece.wav.');
    } catch (error) {
      const message = `Could not render the WAV: ${error.message}`;
      setWavState(message);
      announce(message);
    } finally {
      setRenderingWav(false);
    }
  }

  const modeHint = accessibilityMode
    ? 'Accessibility mode is on. Press A to turn it off. The How to listen section follows.'
    : 'Screen reader tip: press A to turn on accessibility mode. It adds larger text, a shortcut sheet, and a fixed now-playing panel.';

  const howTo = (
    <section className="section-block how-to reading" aria-labelledby="how-title">
      <div className="section-head">
        <h2 id="how-title" tabIndex={-1} ref={howToRef}>How to listen</h2>
        <p>{notes.length ? `${notes.length} playable cells` : 'Waiting for data'}</p>
      </div>
      <p>
        Nothing plays until you ask. Press <kbd>Space</kbd>, or activate the button below, to hear
        the piece. Every control is a real button, and the shortcuts work from anywhere on the page.
      </p>
      <ol>
        <li>
          <strong>Play the piece</strong> plays the largest changes first. The current public file
          fits completely: {plan.count ? `${plan.count} of ${plural(notes.length, 'region')}` : 'the playable regions'}.
        </li>
        <li>
          <strong>Previous</strong> and <strong>Next</strong>, or the <kbd>←</kbd> and <kbd>→</kbd>{' '}
          keys, play one region at a time.
        </li>
        <li>
          <strong>Legend</strong> plays four reference sounds: no change, a small increase, a large
          increase, and a decrease.
        </li>
        <li>
          <strong>Explain</strong> speaks the mapping through the browser's voice. <strong>Stop</strong>{' '}
          stops both audio and speech.
        </li>
      </ol>
      <button
        type="button"
        className="btn btn--primary"
        onClick={handlePlay}
        disabled={!notes.length}
        aria-keyshortcuts="Space"
      >
        Play the piece
      </button>
    </section>
  );

  const dataErrorNotice = dataError ? (
    <div className="notice notice--error" role="alert">
      <p><strong>Data error.</strong> {dataError}</p>
      <button type="button" className="btn btn--small" onClick={() => setDataError('')}>
        Dismiss
      </button>
    </div>
  ) : null;

  const audioErrorNotice = audioError ? (
    <div className="notice notice--error">
      <p><strong>Audio did not start.</strong> {audioError}</p>
      <button type="button" className="btn btn--small" onClick={handlePlay} disabled={!notes.length}>
        Try Play again
      </button>
    </div>
  ) : null;

  const mapSection = (
    <section className="section-block map-section" aria-labelledby="view-title">
      <div className="section-head">
        <h2 id="view-title">{accessibilityMode ? 'The 2012 and 2023 frames' : 'Two nights, one grid'}</h2>
        <p>
          {accessibilityMode
            ? `${cols} columns by ${rows} rows`
            : 'The outlined cell is the region being played.'}
        </p>
      </div>

      {accessibilityMode ? (
        <p className="grid-summary">
          {info
            ? `The comparison is a ${cols} by ${rows} grid: ${info.total} cells. ${notes.length} changed enough to play and are listed at the end of this page. The other ${stable} cells are stable and silent. Each frame below is one image of the same ${info.total}-cell grid.`
            : 'Loading the 16 by 16 grid…'}
        </p>
      ) : null}

      <div className="map-panel panel">
        <div className="view-toggle" role="group" aria-label="Map view">
          <button
            type="button"
            className="btn btn--small"
            aria-pressed={view === 'globe'}
            onClick={() => {
              setWebglMessage('');
              setView('globe');
            }}
          >
            {accessibilityMode ? 'Show 3D view' : '3D view'}
          </button>
          <button
            type="button"
            className="btn btn--small"
            aria-pressed={view === 'frames'}
            onClick={() => setView('frames')}
          >
            Image frames
          </button>
        </div>

        {webglMessage ? <p className="notice" role="status">{webglMessage}</p> : null}

        {view === 'globe' ? (
          <ErrorBoundary onError={() => {
            setView('frames');
            setWebglMessage('The 3D view could not start. Showing the image frames instead.');
          }}>
            <Suspense fallback={<p className="loading">Loading 3D view…</p>}>
              <GlobeView
                notes={notes}
                regions={allRegions}
                rows={rows}
                cols={cols}
                selected={selected}
                onUnavailable={(message) => {
                  setView('frames');
                  setWebglMessage(`${message} Showing the image frames instead.`);
                }}
              />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <FramesView notes={notes} rows={rows} cols={cols} selected={selected} />
        )}
      </div>

      <p className="map-source">
        {sourceText
          ? `Source: ${sourceText}. Relative values, not raw radiance.`
          : info ? 'Source: loaded data. Relative values, not raw radiance.' : 'Loading public/data.json…'}
      </p>
    </section>
  );

  const projectNote = (
    <section className="section-block project-note reading" aria-labelledby="project-note-title">
      <div className="section-head">
        <h2 id="project-note-title">About this project</h2>
      </div>
      <p>
        Earth Jukebox: Change Mode was built in 2026 by the Aham-Bhramasmi team for the NASA Space
        Apps Challenge, The Earth Information Jukebox. It is an independent submission, not an
        official NASA product.
      </p>
      <p>
        The data comes from NASA's Earth Information Center visualization <em>Change in Night Lights
        between 2012 and 2023</em>. The player treats the derived scores as relative values, not raw
        radiance measurements. The playable cells are the ones with a usable change; the rest are
        stable.
      </p>
      <p>
        <Link to="/about">Team, credits, references, and the full disclaimer</Link>.
      </p>
    </section>
  );

  const nowPlaying = <NowPlaying note={activeNote} isPlaying={isPlaying} />;

  const controls = (
    <Controls
      notes={notes}
      volume={volume}
      onVolume={setVolume}
      onPlay={handlePlay}
      onPrevious={() => handleStep(-1)}
      onNext={() => handleStep(1)}
      onLegend={handleLegend}
      onExplain={handleExplain}
      onStop={handleStop}
      onLoadFile={handleLoadFile}
      onDownload={handleDownload}
      renderingWav={renderingWav}
    />
  );

  const status = (
    <>
      {wavState ? <p className="status-line">{wavState}</p> : null}
      {playStatus ? <p className="status-line status-line--done">{playStatus}</p> : null}
    </>
  );

  const ledger = (
    <RegionList
      notes={notes}
      allRegions={allRegions}
      selected={selected}
      onSelect={handleRegion}
      total={info?.total}
    />
  );

  return (
    <div className="listen-page">
      <p className="sr-only" id="sr-mode-hint">{modeHint}</p>

      <header className="listen-hero">
        <h1 id="page-title" tabIndex={-1} aria-describedby="sr-mode-hint">
          Hear how the <em>Earth changed.</em>
        </h1>
        <p className="lede">
          Two NASA night-lights frames, 2012 and 2023, compared on one grid. Every cell that
          changed becomes a note: a bigger change is a higher pitch, and a cell’s column places it
          left or right in the stereo field.
        </p>
        {accessibilityMode ? null : (
          <>
            <div className="hero-actions">
              <button type="button" className="btn btn--primary" onClick={handlePlay} disabled={!notes.length}>
                Play the piece
              </button>
              <Link className="hero-link" to="/how-it-works">How the mapping works</Link>
            </div>
            <p className="hero-note">
              {info ? (
                <>
                  {notes.length} of {info.total} cells changed enough to play:{' '}
                  {increases} increases and {decreases} decreases. The other {stable} cells stayed
                  stable and stay silent.
                </>
              ) : 'Loading the public data…'}
            </p>
          </>
        )}
      </header>

      {dataErrorNotice}

      {!info && !dataError ? (
        <p className="status-line">Loading public/data.json…</p>
      ) : null}
      {info && notes.length === 0 ? (
        <p className="status-line">No playable regions: every region in this file is stable.</p>
      ) : null}

      {accessibilityMode ? (
        <>
          {howTo}
          {audioErrorNotice}
          {controls}
          {status}
          {nowPlaying}
          {projectNote}
          {mapSection}
          {ledger}
        </>
      ) : (
        <>
          {mapSection}
          {nowPlaying}
          {audioErrorNotice}
          {controls}
          {status}
          {ledger}
        </>
      )}
    </div>
  );
}
