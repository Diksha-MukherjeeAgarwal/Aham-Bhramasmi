/*!
 * Night Lights sonification engine
 * NASA Space Apps 2026 · Earth Information Jukebox
 *
 * One file, plain JavaScript, no build step, no dependencies.
 *   <script src="engine.js" defer></script>
 *
 * It sets up its own page, tries to load ./data.json, and falls back to the
 * built-in demo if that fails, like when it’s opened through file://. It then
 * plays the changed regions as a short musical piece.
 *
 * Keys: Space = play piece, ← → = step through regions, L = legend, S = stop.
 *
 * From the console or other code:
 *   SonificationEngine.CONFIG            tweak values live, then press play
 *   SonificationEngine.load(json)        load another dataset
 *   SonificationEngine.render('piece')   -> Promise<AudioBuffer> (offline)
 *   SonificationEngine.toWav(buffer)     -> ArrayBuffer
 */
(() => {
  'use strict';

  if (window.SonificationEngine) return; // script included twice

  /* ---------- settings: tweak the sound here ---------- */

  const CONFIG = {
    dataUrl: 'data.json',
    demoFallback: true,

    // D minor pentatonic across two octaves. rootMidi 62 = D4; the offsets are semitones.
    rootMidi: 62,
    scale: [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24],
    decreaseShift: -12, // decreases drop down an octave
    panWidth: 0.9,      // 1 would pin the edge columns hard left/right

    piece: { spacing: 0.8, maxSeconds: 30, leadIn: 0.12 },

    // Voice shapes. After the attack, the level settles into peak × sustain over
    // the decay window, then fades out at duration.
    // The peaks are kept intentionally low so the compressor only has to catch
    // overlaps, and masterGain brings the level back up.
    increase: { wave: 'triangle', attack: 0.01, duration: 0.8, peak: 0.2, sustain: 0.55, decay: 0.35 },
    decrease: { wave: 'sine',     attack: 0.12, duration: 1.2, peak: 0.16, sustain: 0.5,  decay: 0.45 },

    // The legend gives a steady reference for “no change,” followed by real examples.
    legend: {
      gap: 1.3,
      reference: { wave: 'sine', attack: 0.05, duration: 1.0, release: 0.15, peak: 0.14 },
      smallMagnitude: 0.2,
    },

    // A little room reverb so plain oscillators don’t feel like toy beeps. wet: 0 turns it off.
    reverb: { wet: 0.18, seconds: 1.6, decay: 3 },

    masterGain: 0.4,
    loudness: 1,   // 0..1: how much to lift low notes, which sound quieter at equal level (0 = off)
    compressor: { threshold: -18, knee: 20, ratio: 4, attack: 0.006, release: 0.25 },
    stopFade: 0.04,

    changeLabels: [
      { upTo: 0.34, text: 'small change' },
      { upTo: 0.67, text: 'medium change' },
      { upTo: 1,    text: 'large change' },
    ],
    mapCellLimit: 4096,
  };

  // Same numbers as the first sample file from the CV side.
  const DEMO_DATA = {
    dataset: 'nightlights_2012_2023',
    source: 'NASA EIC visualization',
    grid: { rows: 16, cols: 16 },
    regions: [
      { row: 5,  col: 11, score: 5.173828125,   signed_change: 4.751953125,   direction: 'increase' },
      { row: 5,  col: 13, score: 5.0263671875,  signed_change: 4.8466796875,  direction: 'increase' },
      { row: 4,  col: 9,  score: 4.6767578125,  signed_change: 3.748046875,   direction: 'increase' },
      { row: 4,  col: 13, score: 4.20556640625, signed_change: 3.89208984375, direction: 'increase' },
      { row: 3,  col: 8,  score: 3.70947265625, signed_change: -1.08349609375, direction: 'decrease' },
      { row: 10, col: 7,  score: 3.5595703125,  signed_change: 0.44140625,    direction: 'stable' },
      { row: 6,  col: 11, score: 3.5341796875,  signed_change: 3.431640625,   direction: 'increase' },
      { row: 5,  col: 12, score: 3.26953125,    signed_change: 2.7451171875,  direction: 'increase' },
    ],
  };

  /* ---------- small helpers ---------- */

  const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const midiToHz = (midi) => 440 * 2 ** ((midi - 69) / 12);
  const noteName = (midi) => NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
  const speakable = (name) => name.replace('♯', ' sharp');
  const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');

  function changeLabel(magnitude) {
    const hit = CONFIG.changeLabels.find((l) => magnitude <= l.upTo);
    return (hit || CONFIG.changeLabels[CONFIG.changeLabels.length - 1]).text;
  }

  function panLabel(pan, spoken) {
    if (Math.abs(pan) < 0.01) return spoken ? 'centered' : 'center';
    const pct = Math.round(Math.abs(pan) * 100);
    const side = pan < 0 ? 'left' : 'right';
    return spoken ? pct + ' percent ' + side : pct + '% ' + side[0].toUpperCase();
  }

  // Rough loudness estimate using a simple A-weighting curve. This is just a
  // stand-in for how a pitch will feel to the ear.
  function aWeightDb(f) {
    const f2 = f * f;
    const ra = (12194 ** 2 * f2 * f2) /
      ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2));
    return 20 * Math.log10(ra) + 2;
  }

  // Equal level does not mean equal loudness: a D3 sounds much quieter than a D6.
  // We boost the low notes a bit and trim the very high ones so nothing disappears.
  function loudnessGain(frequency) {
    const dB = clamp(-aWeightDb(frequency) * CONFIG.loudness, -3, 12);
    return 10 ** (dB / 20);
  }

  /* ---------- data to notes ---------- */

  // The magnitude (0..1) picks a note from the scale. This is used by adaptData
  // and by the legend so the mapping stays consistent.
  function pitchFor(magnitude, direction) {
    const step = Math.round(magnitude * (CONFIG.scale.length - 1));
    const midi = CONFIG.rootMidi + CONFIG.scale[step] + (direction === 'down' ? CONFIG.decreaseShift : 0);
    return { step, midi, pitchName: noteName(midi), frequency: midiToHz(midi) };
  }

  /*
   * This is the part that knows what the JSON looks like. It turns the raw data
   * into the playable notes, biggest change first. "stable" regions and any row
   * without a usable signed_change are left out; describeData() covers the counts.
   */
  function adaptData(json) {
    if (!json || typeof json !== 'object' || !Array.isArray(json.regions)) {
      throw new Error('Expected a JSON object with a "regions" array.');
    }

    const usable = [];
    json.regions.forEach((region, sourceIndex) => {
      if (!region || typeof region !== 'object') return;
      const change = Number(region.signed_change);
      if (region.signed_change == null || !Number.isFinite(change)) return;

      const label = String(region.direction || '').trim().toLowerCase();
      if (label === 'stable') return;

      let direction;
      if (label === 'increase') direction = 'up';
      else if (label === 'decrease') direction = 'down';
      else if (change === 0) return; // no label and no change: nothing to play
      else direction = change < 0 ? 'down' : 'up';

      usable.push({ sourceIndex, row: Number(region.row) || 0, col: Number(region.col) || 0, change, direction });
    });

    const { cols } = gridSize(json, usable);
    // Scale against the biggest change we will actually play, not against skipped rows.
    const biggest = usable.reduce((m, r) => Math.max(m, Math.abs(r.change)), 0);

    const notes = usable.map((r) => {
      const magnitude = biggest > 0 ? clamp(Math.abs(r.change) / biggest, 0, 1) : 0;
      const x = clamp((r.col + 0.5) / cols, 0, 1);
      const pan = Math.round(clamp((x * 2 - 1) * CONFIG.panWidth, -1, 1) * 100) / 100;
      return {
        sourceIndex: r.sourceIndex,
        row: r.row,
        col: r.col,
        x,
        pan,
        signedChange: r.change,
        magnitude,
        direction: r.direction,
        changeLabel: changeLabel(magnitude),
        ...pitchFor(magnitude, r.direction),
      };
    });

    // Ties keep file order so the same input always gives the same piece.
    notes.sort((a, b) => b.magnitude - a.magnitude || a.sourceIndex - b.sourceIndex);
    notes.forEach((n, i) => { n.number = i + 1; });
    return notes;
  }

  function gridSize(json, usable) {
    const g = json.grid || {};
    const guess = (key) => usable.reduce((m, r) => Math.max(m, r[key] + 1), 1);
    return {
      rows: Number.isInteger(g.rows) && g.rows > 0 ? g.rows : guess('row'),
      cols: Number.isInteger(g.cols) && g.cols > 0 ? g.cols : guess('col'),
    };
  }

  function describeData(json, notes) {
    const grid = gridSize(json, notes);
    return {
      dataset: typeof json.dataset === 'string' ? json.dataset : '',
      rows: grid.rows,
      cols: grid.cols,
      total: json.regions.length,
      skipped: json.regions.length - notes.length,
      biggest: notes.length ? Math.abs(notes[0].signedChange) : 0,
    };
  }

  /* ---------- audio graph shared by live playback and offline render ---------- */

  function makeImpulse(ctx, seconds, decay) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    const fadeIn = Math.floor(ctx.sampleRate * 0.01);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let seed = 1234 + ch * 77; // fixed seed: every run gets the same room
      for (let i = 0; i < length; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const noise = seed / 2147483648 - 1;
        data[i] = noise * (1 - i / length) ** decay * Math.min(1, i / fadeIn);
      }
    }
    return buffer;
  }

  // voices -> input -> (reverb) -> compressor -> master -> speakers
  function makeBus(ctx) {
    const input = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    for (const key of Object.keys(CONFIG.compressor)) comp[key].value = CONFIG.compressor[key];
    const master = ctx.createGain();
    master.gain.value = CONFIG.masterGain;

    input.connect(comp);
    if (CONFIG.reverb.wet > 0) {
      const room = ctx.createConvolver();
      room.buffer = makeImpulse(ctx, CONFIG.reverb.seconds, CONFIG.reverb.decay);
      const wet = ctx.createGain();
      wet.gain.value = CONFIG.reverb.wet;
      input.connect(room);
      room.connect(wet);
      wet.connect(comp);
    }
    comp.connect(master);
    master.connect(ctx.destination);
    return { input, master };
  }

  // One oscillator with its own envelope and pan. Returns the oscillator.
  function startVoice(ctx, out, voice, when) {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    const panner = ctx.createStereoPanner();
    const end = when + voice.duration;

    osc.type = voice.wave;
    osc.frequency.value = voice.frequency;
    panner.pan.value = voice.pan || 0;

    const peak = voice.peak * loudnessGain(voice.frequency);

    amp.gain.setValueAtTime(0, when);
    amp.gain.linearRampToValueAtTime(peak, when + voice.attack);
    if (voice.steady) {
      // reference tone: flat top, short release
      amp.gain.setValueAtTime(peak, end - voice.release);
      amp.gain.linearRampToValueAtTime(0, end);
    } else {
      const settled = when + voice.attack + (voice.duration - voice.attack) * voice.decay;
      amp.gain.exponentialRampToValueAtTime(peak * voice.sustain, settled);
      amp.gain.exponentialRampToValueAtTime(0.0001, end);
    }

    osc.connect(amp);
    amp.connect(panner);
    panner.connect(out);
    osc.start(when);
    osc.stop(end + 0.05);
    return osc;
  }

  const voiceFor = (note) => ({
    ...(note.direction === 'down' ? CONFIG.decrease : CONFIG.increase),
    frequency: note.frequency,
    pan: note.pan,
  });

  /* ---------- what to play (data only, no audio objects) ---------- */

  function planPiece(notes) {
    const longest = Math.max(CONFIG.increase.duration, CONFIG.decrease.duration);
    const fits = Math.floor((CONFIG.piece.maxSeconds - CONFIG.piece.leadIn - longest) / CONFIG.piece.spacing) + 1;
    const count = Math.max(0, Math.min(notes.length, fits));
    const slots = notes.slice(0, count).map((note, i) => ({
      index: i,
      note,
      at: CONFIG.piece.leadIn + i * CONFIG.piece.spacing,
    }));
    const last = slots[slots.length - 1];
    const seconds = last ? last.at + voiceFor(last.note).duration : 0;
    return { slots, count, seconds };
  }

  function planLegend() {
    const { gap, reference, smallMagnitude } = CONFIG.legend;
    const root = pitchFor(0, 'up');
    const small = pitchFor(smallMagnitude, 'up');
    const large = pitchFor(1, 'up');
    const drop = pitchFor(1, 'down');
    const asNote = (p, direction) => ({ direction, frequency: p.frequency, pan: 0 });

    const steps = [
      {
        voice: { ...reference, steady: true, frequency: root.frequency, pan: 0 },
        text: 'Legend. Steady tone, ' + speakable(root.pitchName) + ': no change.',
      },
      {
        voice: voiceFor(asNote(small, 'up')),
        text: 'Legend. Small increase, ' + speakable(small.pitchName) + ', bright and short.',
      },
      {
        voice: voiceFor(asNote(large, 'up')),
        text: 'Legend. Large increase, ' + speakable(large.pitchName) + ', bright and short.',
      },
      {
        voice: voiceFor(asNote(drop, 'down')),
        text: 'Legend. Large decrease, ' + speakable(drop.pitchName) + ', dark and slow.',
      },
    ];
    steps.forEach((s, i) => { s.at = CONFIG.piece.leadIn + i * gap; });
    const last = steps[steps.length - 1];
    return { steps, seconds: last.at + last.voice.duration };
  }

  /* ---------- offline render + WAV ---------- */

  const SAMPLE_RATE = 44100;

  async function render(kind) {
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Offline) throw new Error('Offline rendering is not supported in this browser.');

    const legend = kind === 'legend';
    const plan = legend ? planLegend() : planPiece(state.notes);
    if (!legend && !plan.count) throw new Error('There is nothing to render yet.');

    const tail = CONFIG.reverb.wet > 0 ? CONFIG.reverb.seconds : 0.2;
    const ctx = new Offline(2, Math.ceil((plan.seconds + tail + 0.1) * SAMPLE_RATE), SAMPLE_RATE);
    const bus = makeBus(ctx);

    if (legend) plan.steps.forEach((s) => startVoice(ctx, bus.input, s.voice, s.at));
    else plan.slots.forEach((s) => startVoice(ctx, bus.input, voiceFor(s.note), s.at));
    return ctx.startRendering();
  }

  function toWav(buffer) {
    const channels = buffer.numberOfChannels;
    const frames = buffer.length;
    const dataBytes = frames * channels * 2;
    const view = new DataView(new ArrayBuffer(44 + dataBytes));
    const text = (at, s) => { for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i)); };

    text(0, 'RIFF');
    view.setUint32(4, 36 + dataBytes, true);
    text(8, 'WAVEfmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, channels, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true);
    text(36, 'data');
    view.setUint32(40, dataBytes, true);

    const data = [];
    for (let c = 0; c < channels; c++) data.push(buffer.getChannelData(c));
    let at = 44;
    for (let i = 0; i < frames; i++) {
      for (let c = 0; c < channels; c++) {
        const s = clamp(data[c][i], -1, 1);
        view.setInt16(at, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        at += 2;
      }
    }
    return view.buffer;
  }

  /* ---------- live playback ---------- */

  const state = {
    notes: [],
    info: null,
    sourceLabel: '',
    index: -1,      // region the arrow keys continue from
    ticket: 0,      // bumps on every play/stop so stale timers can tell they are stale
    ctx: null,
    bus: null,
    busyUntil: 0,   // audio-clock time when the last queued sound (and its reverb) is gone
    voices: new Set(),
    timers: new Set(),
    loadId: 0,
  };
  const ui = {};
  const NOTHING = 'Nothing to play yet. Load a JSON file with changed regions.';

  async function getAudio() {
    if (!state.ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) throw new Error('This browser has no Web Audio support.');
      state.ctx = new Ctor();
      state.bus = makeBus(state.ctx);
    }
    if (state.ctx.state !== 'running') await state.ctx.resume();
    if (state.ctx.state !== 'running') throw new Error('Audio is blocked. Click Play again.');
    return state.ctx;
  }

  function playVoice(voice, when) {
    const osc = startVoice(state.ctx, state.bus.input, voice, when);
    state.busyUntil = Math.max(state.busyUntil, when + voice.duration + CONFIG.reverb.seconds);
    state.voices.add(osc);
    osc.onended = () => state.voices.delete(osc);
  }

  function later(ticket, when, fn) {
    const ms = Math.max(0, (when - state.ctx.currentTime) * 1000);
    const id = setTimeout(() => {
      state.timers.delete(id);
      if (ticket === state.ticket) fn();
    }, ms);
    state.timers.add(id);
  }

  // Mute everything that is playing or queued, reverb tail included.
  // The old bus fades out and a fresh one takes over for the next sound.
  function hush() {
    state.timers.forEach(clearTimeout);
    state.timers.clear();
    if (!state.ctx || !state.bus) return;

    const now = state.ctx.currentTime;
    if (now >= state.busyUntil) return; // nothing playing, nothing ringing
    const old = state.bus;
    old.master.gain.setValueAtTime(old.master.gain.value, now);
    old.master.gain.linearRampToValueAtTime(0, now + CONFIG.stopFade);
    state.voices.forEach((osc) => { try { osc.stop(now + CONFIG.stopFade + 0.02); } catch (_) { /* already stopped */ } });
    state.voices.clear();
    setTimeout(() => old.master.disconnect(), (CONFIG.stopFade + 0.3) * 1000);
    state.bus = makeBus(state.ctx);
  }

  // Every play button goes through here. Resolves to a ticket, or 0 if the
  // user pressed something else while the audio context was waking up.
  async function begin() {
    const wanted = ++state.ticket;
    try {
      await getAudio();
    } catch (err) {
      say(err.message);
      return 0;
    }
    if (wanted !== state.ticket) return 0;
    hush();
    return wanted;
  }

  function stop() {
    state.ticket++;
    hush();
    setPlaying(false);
    say('Stopped.');
  }

  async function playPiece() {
    if (!state.notes.length) return say(NOTHING);
    const ticket = await begin();
    if (!ticket) return;

    const plan = planPiece(state.notes);
    const t0 = state.ctx.currentTime;
    setPlaying(true);
    say('Playing ' + plural(plan.count, 'region') + ', largest first.');

    for (const slot of plan.slots) {
      playVoice(voiceFor(slot.note), t0 + slot.at);
      later(ticket, t0 + slot.at, () => {
        select(slot.index);
        say(describe(slot.note));
      });
    }
    later(ticket, t0 + plan.seconds + 0.25, () => {
      setPlaying(false);
      const left = state.notes.length - plan.count;
      say('Piece complete: ' + plural(plan.count, 'region') + ' played' +
        (left ? ', ' + left + ' left out by the ' + CONFIG.piece.maxSeconds + ' second limit.' : '.'));
    });
  }

  async function playRegion(i) {
    const total = state.notes.length;
    if (!total) return say(NOTHING);
    const index = ((i % total) + total) % total;

    const ticket = await begin();
    if (!ticket) return;

    const note = state.notes[index];
    const voice = voiceFor(note);
    const t0 = state.ctx.currentTime + 0.05;
    playVoice(voice, t0);
    select(index);
    setPlaying(true);
    say(describe(note));
    later(ticket, t0 + voice.duration + 0.2, () => setPlaying(false));
  }

  function step(dir) {
    const total = state.notes.length;
    if (!total) return void playRegion(0);
    const next = state.index < 0 ? (dir > 0 ? 0 : total - 1) : (state.index + dir + total) % total;
    void playRegion(next);
  }

  async function playLegend() {
    const ticket = await begin();
    if (!ticket) return;

    const plan = planLegend();
    const t0 = state.ctx.currentTime + 0.05;
    setPlaying(true);
    for (const s of plan.steps) {
      playVoice(s.voice, t0 + s.at);
      later(ticket, t0 + s.at, () => say(s.text));
    }
    later(ticket, t0 + plan.seconds + 0.25, () => {
      setPlaying(false);
      say('Legend finished. Higher means a bigger change; the dark, slow note is a decrease.');
    });
  }

  async function saveWav() {
    if (!state.notes.length) return say(NOTHING);
    say('Rendering WAV…');
    try {
      const buffer = await render('piece');
      const url = URL.createObjectURL(new Blob([toWav(buffer)], { type: 'audio/wav' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'night-lights-piece.wav';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      say('Saved night-lights-piece.wav.');
    } catch (err) {
      say('Could not save the WAV: ' + err.message);
    }
  }

  /* ---------- text shown / announced ---------- */

  function describe(note) {
    return 'Region ' + note.number + ' of ' + state.notes.length + ': row ' + note.row + ', column ' + note.col +
      '. ' + (note.direction === 'up' ? 'Increase' : 'Decrease') + ', ' + note.changeLabel +
      '. Pitch ' + speakable(note.pitchName) + ', ' + panLabel(note.pan, true) + '.';
  }

  function say(text) {
    if (ui.live) ui.live.textContent = text;
  }

  function setPlaying(on) {
    if (ui.console) ui.console.classList.toggle('is-playing', on);
  }

  function select(index) {
    state.index = index;
    ui.list.querySelectorAll('.se-region').forEach((btn, i) => {
      btn.classList.toggle('is-active', i === index);
      if (i === index) {
        btn.setAttribute('aria-current', 'true');
        btn.scrollIntoView({ block: 'nearest' });
      } else {
        btn.removeAttribute('aria-current');
      }
    });
    ui.map.querySelectorAll('.is-active').forEach((c) => c.classList.remove('is-active'));
    const note = state.notes[index];
    if (note && note.row < state.info.rows && note.col < state.info.cols) {
      const cell = ui.map.children[note.row * state.info.cols + note.col];
      if (cell) cell.classList.add('is-active');
    }
  }

  /* ---------- page ---------- */

  const CSS = `
:root {
  --se-bg: #05080e; --se-line: rgba(151,183,220,.16); --se-line-strong: rgba(151,183,220,.34);
  --se-text: #edf2f8; --se-muted: #91a5bb; --se-amber: #ffb454; --se-amber-hi: #ffd18c;
  --se-cyan: #58d7cf; --se-focus: #a7e8ff;
  --se-sans: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --se-serif: "Iowan Old Style", Palatino, "Palatino Linotype", Georgia, serif;
  --se-mono: ui-monospace, SFMono-Regular, Consolas, monospace;
}
body.se-mounted { margin: 0; background: var(--se-bg); }
#se-app {
  min-height: 100vh; color: var(--se-text); font-family: var(--se-sans);
  background:
    radial-gradient(1000px 640px at 85% -10%, rgba(255,180,84,.09), transparent 62%),
    radial-gradient(800px 600px at 0% 12%, rgba(88,215,207,.06), transparent 62%),
    var(--se-bg);
}
#se-app *, #se-app *::before, #se-app *::after { box-sizing: border-box; }
#se-app button { font: inherit; color: inherit; }
#se-app :focus-visible { outline: 2px solid var(--se-focus); outline-offset: 2px; }
.se-shell { max-width: 1180px; margin: 0 auto; padding: 24px 32px 32px; }

.se-top { display: flex; align-items: center; justify-content: space-between; gap: 20px;
  padding-bottom: 20px; border-bottom: 1px solid var(--se-line); }
.se-kicker, .se-label { font: 10px/1.3 var(--se-mono); letter-spacing: .14em; text-transform: uppercase; }
.se-kicker { color: var(--se-amber); display: block; }
.se-name { font: 20px var(--se-serif); }
.se-source { display: flex; align-items: center; gap: 16px; min-width: 0; text-align: right; }
.se-source small { display: block; max-width: 320px; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; color: var(--se-muted); font-size: 11px; }
.se-source small[data-tone="warn"] { color: var(--se-amber); }
.se-source small[data-tone="error"] { color: #ff8f85; }

.se-hero { max-width: 880px; padding: 52px 0 34px; }
.se-hero h1 { margin: 0 0 18px; font: 400 clamp(42px, 6vw, 78px)/1 var(--se-serif); letter-spacing: -.035em; }
.se-hero em { color: var(--se-amber-hi); }
.se-hero p { max-width: 62ch; margin: 0; color: var(--se-muted); line-height: 1.65; }
.se-hero strong { color: var(--se-text); font-weight: 500; }

.se-console { display: flex; flex-wrap: wrap; gap: 20px; justify-content: space-between; padding: 16px;
  border: 1px solid var(--se-line); border-radius: 16px; background: rgba(12,20,32,.8); }
.se-transport { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.se-btn { display: inline-flex; align-items: center; gap: 8px; height: 42px; padding: 0 14px;
  border: 1px solid var(--se-line-strong); border-radius: 10px; background: rgba(255,255,255,.03);
  font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.se-btn:hover { background: rgba(255,255,255,.08); }
.se-btn kbd, .se-keys kbd { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 5px;
  border: 1px solid var(--se-line-strong); border-radius: 5px; background: rgba(0,0,0,.25);
  color: var(--se-muted); font: 10px var(--se-mono); }
.se-btn--main { padding: 0 18px; border-color: var(--se-amber); background: var(--se-amber); color: #1b1205; }
.se-btn--main:hover { background: var(--se-amber-hi); }
.se-btn--main kbd { color: #46320f; border-color: rgba(27,18,5,.35); background: rgba(27,18,5,.1); }
.se-btn--quiet { height: 36px; background: transparent; font-size: 12px; }

.se-now { flex: 1 1 300px; display: flex; align-items: center; gap: 14px; min-width: 0; }
.se-eq { display: flex; align-items: flex-end; gap: 3px; height: 22px; }
.se-eq i { width: 3px; height: 30%; background: var(--se-muted); border-radius: 2px; }
.is-playing .se-eq i { background: var(--se-amber); animation: se-eq .9s ease-in-out infinite alternate; }
.se-eq i:nth-child(2) { animation-delay: -.3s; } .se-eq i:nth-child(3) { animation-delay: -.6s; }
.se-eq i:nth-child(4) { animation-delay: -.2s; } .se-eq i:nth-child(5) { animation-delay: -.5s; }
@keyframes se-eq { to { height: 100%; } }
.se-now p { margin: 4px 0 0; font-size: 14px; line-height: 1.45; }

.se-layout { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(280px, 1fr); gap: 20px; margin-top: 20px; }
.se-card { padding: 20px; border: 1px solid var(--se-line); border-radius: 16px; background: rgba(12,20,32,.7); }
.se-card h2 { margin: 0 0 6px; font: 400 22px var(--se-serif); }
.se-card p { margin: 0 0 8px; color: var(--se-muted); font-size: 13px; line-height: 1.55; }
.se-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
.se-count { margin-left: 8px; padding: 2px 8px; border: 1px solid var(--se-line-strong); border-radius: 99px;
  color: var(--se-muted); font: 11px var(--se-mono); vertical-align: middle; white-space: nowrap; }

#se-map { display: grid; width: 120px; aspect-ratio: 1; gap: 1px; padding: 4px;
  border: 1px solid var(--se-line); border-radius: 8px; background: #070d16; }
.se-cell { background: rgba(255,255,255,.04); }
.se-cell.is-up { background: rgba(255,180,84, calc(.3 + var(--mag) * .7)); }
.se-cell.is-down { background: rgba(88,215,207, calc(.3 + var(--mag) * .7)); }
.se-cell.is-active { outline: 2px solid #fff; z-index: 1; }
.se-map-note { display: block; margin-top: 4px; text-align: center; color: var(--se-muted); font: 10px var(--se-mono); }

.se-list { margin: 14px 0 0; padding: 0; list-style: none; display: grid; gap: 6px; max-height: 460px; overflow: auto; }
.se-region { display: grid; grid-template-columns: 30px 1fr 110px 90px; gap: 12px; align-items: center; width: 100%;
  padding: 10px 12px; text-align: left; border: 1px solid var(--se-line); border-radius: 10px;
  background: rgba(255,255,255,.02); cursor: pointer; }
.se-region:hover { background: rgba(255,255,255,.06); }
.se-region.is-active { border-color: var(--se-amber); background: rgba(255,180,84,.1); }
.se-region[data-dir="down"].is-active { border-color: var(--se-cyan); background: rgba(88,215,207,.1); }
.se-num { color: var(--se-muted); font: 12px var(--se-mono); }
.se-dir { display: block; font-size: 13px; font-weight: 600; }
.se-region[data-dir="up"] .se-dir { color: var(--se-amber); }
.se-region[data-dir="down"] .se-dir { color: var(--se-cyan); }
.se-where { color: var(--se-muted); font: 11px var(--se-mono); }
.se-bar { display: block; height: 5px; border-radius: 3px; background: rgba(255,255,255,.08); overflow: hidden; }
.se-bar i { display: block; height: 100%; background: var(--se-amber); }
.se-region[data-dir="down"] .se-bar i { background: var(--se-cyan); }
.se-read { text-align: right; font: 12px var(--se-mono); }
.se-read span { display: block; color: var(--se-muted); font-size: 10px; }

.se-side { display: grid; gap: 20px; align-content: start; }
.se-rows { margin: 12px 0 0; display: grid; gap: 8px; }
.se-rows div { display: grid; grid-template-columns: 72px 1fr; gap: 10px; font-size: 13px; line-height: 1.45; }
.se-rows dt { color: var(--se-muted); font: 10px var(--se-mono); letter-spacing: .1em; text-transform: uppercase; padding-top: 2px; }
.se-rows dd { margin: 0; }
.se-table-wrap { max-height: 280px; overflow: auto; margin-top: 8px; }
.se-table { width: 100%; border-collapse: collapse; font: 12px var(--se-mono); }
.se-table th { position: sticky; top: 0; background: #0b1320; color: var(--se-muted); font-weight: 500; text-align: left; padding: 6px 8px; }
.se-table td { padding: 6px 8px; border-top: 1px solid var(--se-line); }
.se-foot { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; margin-top: 24px;
  padding-top: 16px; border-top: 1px solid var(--se-line); color: var(--se-muted); font-size: 12px; }
.se-keys { display: flex; flex-wrap: wrap; gap: 14px; }
.se-hide { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }

@media (max-width: 900px) {
  .se-layout { grid-template-columns: 1fr; }
  .se-top { flex-direction: column; align-items: flex-start; }
  .se-source { text-align: left; }
}
@media (max-width: 600px) {
  .se-shell { padding: 18px 16px 24px; }
  .se-region { grid-template-columns: 26px 1fr 70px; }
  .se-region .se-read { display: none; }
}
@media (prefers-reduced-motion: reduce) { .is-playing .se-eq i { animation: none; height: 70%; } }
`;

  const HTML = `
<div id="se-app"><div class="se-shell">
  <header class="se-top">
    <div>
      <span class="se-kicker">NASA Space Apps · Sonification</span>
      <span class="se-name">Night Lights Engine</span>
    </div>
    <div class="se-source">
      <div>
        <span class="se-label" style="color:var(--se-muted)">Data source</span>
        <div id="se-source-name">Fetching data.json…</div>
        <small id="se-source-note"></small>
      </div>
      <button type="button" class="se-btn se-btn--quiet" id="se-load">Load JSON</button>
      <input type="file" id="se-file" accept=".json,application/json" hidden>
    </div>
  </header>

  <main>
    <section class="se-hero" aria-labelledby="se-title">
      <h1 id="se-title">Night lights,<br><em>scored for stereo.</em></h1>
      <p>A deterministic sonification of changed regions from a satellite night-lights map.
         <strong>A bigger change is a higher pitch</strong>, and a region’s place on the grid becomes its place
         in the stereo field. The biggest changes play first. Values are derived from a NASA visualization,
         not from raw measurements.</p>
    </section>

    <section class="se-console" id="se-console" aria-label="Playback controls">
      <div class="se-transport" role="group" aria-label="Transport">
        <button type="button" class="se-btn se-btn--main" id="se-play" title="Play the whole piece (Space)">▶ Play piece <kbd aria-hidden="true">Space</kbd></button>
        <button type="button" class="se-btn" id="se-prev" title="Previous region (Left arrow)">← Previous</button>
        <button type="button" class="se-btn" id="se-next" title="Next region (Right arrow)">Next →</button>
        <button type="button" class="se-btn" id="se-legend" title="Play the legend (L)">Legend <kbd aria-hidden="true">L</kbd></button>
        <button type="button" class="se-btn" id="se-stop" title="Stop all sound (S)">■ Stop <kbd aria-hidden="true">S</kbd></button>
        <button type="button" class="se-btn se-btn--quiet" id="se-save" title="Download the piece as a WAV file">Save WAV</button>
      </div>
      <div class="se-now">
        <div class="se-eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
        <div>
          <span class="se-label" style="color:var(--se-muted)">Now</span>
          <p id="se-live" role="status" aria-live="polite" aria-atomic="true">Ready. Press Space to play the whole piece.</p>
        </div>
      </div>
    </section>

    <div class="se-layout">
      <section class="se-card" aria-labelledby="se-regions-title">
        <div class="se-head">
          <div>
            <h2 id="se-regions-title">Changed regions<span class="se-count" id="se-count">0 notes</span></h2>
            <p>Largest first. Pick a row to hear that note on its own.</p>
            <p id="se-skip"></p>
          </div>
          <figure id="se-map-fig" style="margin:0" hidden>
            <div id="se-map" aria-hidden="true"></div>
            <figcaption class="se-map-note" id="se-map-note"></figcaption>
          </figure>
        </div>
        <ol class="se-list" id="se-list" aria-label="Playable regions"></ol>
        <p id="se-empty">No playable regions yet.</p>
      </section>

      <aside class="se-side" aria-label="Reference and verification">
        <section class="se-card" aria-labelledby="se-guide-title">
          <h2 id="se-guide-title">How to listen</h2>
          <dl class="se-rows" id="se-guide"></dl>
          <p style="margin-top:12px">Press <b>L</b> for the legend: a steady “no change” tone, then a small increase, a large increase and a large decrease.</p>
        </section>
        <section class="se-card" aria-labelledby="se-check-title">
          <h2 id="se-check-title">Self-check</h2>
          <p>Every computed note, so you can verify without listening.</p>
          <div class="se-table-wrap">
            <table class="se-table">
              <caption class="se-hide">Computed notes: order, cell, direction, magnitude, pitch and pan</caption>
              <thead><tr><th scope="col">#</th><th scope="col">Cell</th><th scope="col">Dir</th><th scope="col">Mag</th><th scope="col">Pitch</th><th scope="col">Pan</th></tr></thead>
              <tbody id="se-check-body"></tbody>
            </table>
          </div>
          <p id="se-check-foot" style="margin-top:8px"></p>
        </section>
      </aside>
    </div>
  </main>

  <footer class="se-foot">
    <span>Audio starts on your first click or key press. Same data, same notes, every time.</span>
    <span class="se-keys"><span><kbd>Space</kbd> play</span><span><kbd>←</kbd><kbd>→</kbd> step</span><span><kbd>L</kbd> legend</span><span><kbd>S</kbd> stop</span></span>
  </footer>
</div></div>`;

  function renderList() {
    ui.list.innerHTML = state.notes.map((n, i) => `
      <li><button type="button" class="se-region" data-index="${i}" data-dir="${n.direction}"
          aria-label="${describe(n)} Activate to play this note.">
        <span class="se-num">${String(n.number).padStart(2, '0')}</span>
        <span><span class="se-dir">${n.direction === 'up' ? '▲ increase' : '▼ decrease'}</span>
          <span class="se-where">row ${n.row} · col ${n.col}</span></span>
        <span><span class="se-bar"><i style="width:${Math.max(3, n.magnitude * 100)}%"></i></span>
          <span class="se-where">${Math.round(n.magnitude * 100)}%</span></span>
        <span class="se-read">${n.pitchName}<span>${panLabel(n.pan)}</span></span>
      </button></li>`).join('');
  }

  function renderMap() {
    const { rows, cols } = state.info;
    const show = state.notes.length > 0 && rows * cols <= CONFIG.mapCellLimit;
    ui.mapFig.hidden = !show;
    ui.map.textContent = '';
    if (!show) return;

    ui.map.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    ui.map.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    ui.mapNote.textContent = `${cols} × ${rows} · W → E`;

    const cells = Array.from({ length: rows * cols }, () => document.createElement('span'));
    cells.forEach((c) => { c.className = 'se-cell'; });
    // notes are sorted biggest first, so the first note on a cell wins
    const seen = new Set();
    for (const n of state.notes) {
      const at = n.row * cols + n.col;
      if (at < 0 || at >= cells.length || seen.has(at)) continue;
      seen.add(at);
      cells[at].classList.add(n.direction === 'up' ? 'is-up' : 'is-down');
      cells[at].style.setProperty('--mag', n.magnitude.toFixed(3));
    }
    ui.map.append(...cells);
  }

  function renderCheck() {
    ui.checkBody.innerHTML = state.notes.map((n) => `
      <tr><td>${String(n.number).padStart(2, '0')}</td><td>${n.row},${n.col}</td>
      <td>${n.direction === 'up' ? '▲ up' : '▼ down'}</td><td>${Math.round(n.magnitude * 100)}%</td>
      <td>${n.pitchName}</td><td>${n.pan.toFixed(2)}</td></tr>`).join('');

    const top = CONFIG.rootMidi + CONFIG.scale[CONFIG.scale.length - 1];
    ui.checkFoot.textContent = state.notes.length
      ? `${state.notes.length} of ${state.info.total} regions · ${noteName(CONFIG.rootMidi)}–${noteName(top)} · pan ±${CONFIG.panWidth.toFixed(2)}`
      : 'No playable notes.';
  }

  // The guide reads CONFIG, so it never drifts when someone tunes the numbers.
  function renderGuide() {
    const low = noteName(CONFIG.rootMidi);
    const high = noteName(CONFIG.rootMidi + CONFIG.scale[CONFIG.scale.length - 1]);
    const inc = CONFIG.increase;
    const dec = CONFIG.decrease;
    const octaves = Math.abs(CONFIG.decreaseShift / 12);
    ui.guide.innerHTML = `
      <div><dt>Pitch</dt><dd><b>Size of change</b> → ${CONFIG.scale.length}-note scale, ${low}–${high}.</dd></div>
      <div><dt>Increase</dt><dd>▲ ${inc.wave} wave, ${Math.round(inc.attack * 1000)} ms attack, <b>${inc.duration} s</b></dd></div>
      <div><dt>Decrease</dt><dd>▼ ${dec.wave} wave, ${octaves} octave${octaves === 1 ? '' : 's'} lower, ${Math.round(dec.attack * 1000)} ms attack, <b>${dec.duration} s</b></dd></div>
      <div><dt>Pan</dt><dd><b>West → east</b> becomes left → right.</dd></div>`;
  }

  function renderAll() {
    renderList();
    renderMap();
    renderCheck();
    renderGuide();
    ui.count.textContent = plural(state.notes.length, 'note');
    ui.empty.hidden = state.notes.length > 0;
    ui.empty.textContent = state.info.total > 0
      ? 'No playable regions: every region is stable.'
      : 'No playable regions. Load a JSON file with a regions array.';
    ui.skip.textContent = (state.info.skipped ? plural(state.info.skipped, 'region') + ' skipped · ' : '') +
      state.info.cols + ' × ' + state.info.rows + ' grid';
  }

  function showSource(label, note, tone) {
    ui.sourceName.textContent = state.info && state.info.dataset ? state.info.dataset : label;
    ui.sourceNote.textContent = note;
    ui.sourceNote.title = note;
    ui.sourceNote.dataset.tone = tone || '';
  }

  /* ---------- loading data ---------- */

  function applyData(json, label, problem) {
    let notes;
    try {
      notes = adaptData(json);
    } catch (err) {
      showSource(label, label + ': ' + err.message, 'error');
      say(label + ': ' + err.message);
      return false;
    }

    stop();
    state.notes = notes;
    state.info = describeData(json, notes);
    state.sourceLabel = label;
    state.index = -1;
    renderAll();

    const grid = state.info.cols + ' × ' + state.info.rows + ' grid';
    if (problem) showSource(label, label + ' · ' + grid + ' · data.json unavailable (' + problem + ')', 'warn');
    else showSource(label, label + ' · ' + grid);

    console.info('[Night Lights] ' + notes.length + ' notes from ' + label);
    if (notes.length) console.table(notes.map((n) => ({
      region: n.number, row: n.row, col: n.col, dir: n.direction,
      magnitude: +n.magnitude.toFixed(3), pitch: n.pitchName, pan: n.pan,
    })));

    say(notes.length
      ? (problem ? 'data.json could not be loaded, so the built-in demo is loaded. ' : 'Loaded ' + plural(notes.length, 'changed region') + '. ') +
        'Press Space to play, or use the arrow keys to step through regions.'
      : 'Loaded ' + label + ', but there is nothing to play.');
    return true;
  }

  async function loadFromUrl() {
    const id = ++state.loadId;
    ui.sourceNote.textContent = 'Fetching ' + CONFIG.dataUrl + '…';
    try {
      const res = await fetch(CONFIG.dataUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      if (id === state.loadId) applyData(json, CONFIG.dataUrl);
    } catch (err) {
      if (id !== state.loadId) return;
      if (CONFIG.demoFallback) applyData(DEMO_DATA, 'Built-in demo', err.message);
      else showSource(CONFIG.dataUrl, 'Could not load ' + CONFIG.dataUrl + ': ' + err.message, 'error');
    }
  }

  async function loadFile(file) {
    const id = ++state.loadId;
    try {
      const json = JSON.parse(await file.text());
      if (id === state.loadId) applyData(json, file.name);
    } catch (err) {
      if (id !== state.loadId) return;
      const msg = err instanceof SyntaxError ? 'that file is not valid JSON' : err.message;
      showSource(file.name, 'Could not load ' + file.name + ': ' + msg, 'error');
      say('Could not load ' + file.name + ': ' + msg + '.');
    }
  }

  /* ---------- keyboard + boot ---------- */

  function onKey(e) {
    if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
    const key = (e.key || '').toLowerCase();

    if (e.code === 'Space') {
      // on a focused button, Space should press that button
      if (document.activeElement && document.activeElement.closest('button, a, summary')) return;
      e.preventDefault();
      void playPiece();
    } else if (key === 'arrowleft') {
      e.preventDefault();
      step(-1);
    } else if (key === 'arrowright') {
      e.preventDefault();
      step(1);
    } else if (key === 'l') {
      e.preventDefault();
      void playLegend();
    } else if (key === 's') {
      e.preventDefault();
      stop();
    }
  }

  function boot() {
    document.documentElement.lang = document.documentElement.lang || 'en';
    document.title = document.title || 'Night Lights — Sonification';

    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.append(style);

    const holder = document.createElement('div');
    holder.innerHTML = HTML;
    document.body.append(holder.firstElementChild);
    document.body.classList.add('se-mounted');

    const $ = (id) => document.getElementById('se-' + id);
    Object.assign(ui, {
      console: $('console'), live: $('live'), list: $('list'), map: $('map'), mapFig: $('map-fig'),
      mapNote: $('map-note'), count: $('count'), empty: $('empty'), skip: $('skip'), guide: $('guide'),
      checkBody: $('check-body'), checkFoot: $('check-foot'), sourceName: $('source-name'),
      sourceNote: $('source-note'), file: $('file'),
    });
    state.info = { rows: 0, cols: 0, total: 0, skipped: 0, dataset: '' };

    $('play').addEventListener('click', () => void playPiece());
    $('prev').addEventListener('click', () => step(-1));
    $('next').addEventListener('click', () => step(1));
    $('legend').addEventListener('click', () => void playLegend());
    $('stop').addEventListener('click', stop);
    $('save').addEventListener('click', () => void saveWav());
    $('load').addEventListener('click', () => ui.file.click());
    ui.file.addEventListener('change', () => {
      const file = ui.file.files[0];
      ui.file.value = '';
      if (file) void loadFile(file);
    });
    ui.list.addEventListener('click', (e) => {
      const btn = e.target.closest('.se-region');
      if (btn) void playRegion(Number(btn.dataset.index));
    });
    document.addEventListener('keydown', onKey);

    void loadFromUrl();
  }

  window.SonificationEngine = {
    CONFIG,
    adaptData,
    notes: () => state.notes.slice(),
    planPiece,
    planLegend,
    play: playPiece,
    stop,
    next: () => step(1),
    previous: () => step(-1),
    legend: playLegend,
    render,
    toWav,
    load: (json) => { state.loadId++; return applyData(json, 'API'); },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();