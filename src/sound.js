// All sound in the app is made live with the Web Audio API, so no sound files are
// needed except the real NASA voice notes. Machines can also speak their replies
// out loud with the browser's built-in voice.

let ctx = null;
let master = null;
let ambient = null;
let staticNode = null;
let enabled = true;

try {
  enabled = localStorage.getItem("lsom-sound") !== "off";
} catch {
  /* storage can be blocked; default to on */
}

const listeners = new Set();
export const onSoundChange = (fn) => listeners.add(fn);
export const soundOn = () => enabled;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = enabled ? 1 : 0;
  master.connect(ctx.destination);
  return ctx;
}

function noiseBuffer(seconds = 2) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function noiseSource() {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer();
  src.loop = true;
  return src;
}

// Call on the first tap or click: browsers only allow sound after the person interacts.
export function wake() {
  if (!ensure()) return;
  if (ctx.state === "suspended") ctx.resume();
  if (!ambient) startAmbient();
}

function startAmbient() {
  const out = ctx.createGain();
  out.gain.value = 0;
  out.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 4);
  out.connect(master);

  // A low, slow space hum: two soft tones that beat against each other.
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 420;
  lp.connect(out);
  for (const [f, g] of [
    [55, 0.05],
    [82.6, 0.035],
    [110.3, 0.015],
  ]) {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    const gain = ctx.createGain();
    gain.gain.value = g;
    o.connect(gain).connect(lp);
    o.start();
  }

  // Faint cosmic wind that slowly swells and fades.
  const n = noiseSource();
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 500;
  bp.Q.value = 0.8;
  const ng = ctx.createGain();
  ng.gain.value = 0.012;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.009;
  lfo.connect(lfoGain).connect(ng.gain);
  n.connect(bp).connect(ng).connect(out);
  n.start();
  lfo.start();
  ambient = out;
}

function tone(freq, start, dur, { type = "sine", vol = 0.12, to = null } = {}) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (to) o.frequency.exponentialRampToValueAtTime(to, start + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vol, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(master);
  o.start(start);
  o.stop(start + dur + 0.05);
}

function burst(start, dur, from, to, vol = 0.08) {
  const n = noiseSource();
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 2;
  bp.frequency.setValueAtTime(from, start);
  bp.frequency.exponentialRampToValueAtTime(to, start + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  n.connect(bp).connect(g).connect(master);
  n.start(start);
  n.stop(start + dur + 0.05);
}

const ready = () => ctx && enabled;

export function hover() {
  if (!ready()) return;
  tone(1320, ctx.currentTime, 0.06, { vol: 0.04 });
}

// Tuning the radio into a far-away machine.
export function tuneIn() {
  if (!ready()) return;
  const t = ctx.currentTime;
  burst(t, 0.7, 4000, 600, 0.1);
  tone(660, t + 0.55, 0.12, { type: "square", vol: 0.03 });
  tone(990, t + 0.7, 0.18, { type: "square", vol: 0.03 });
}

export function send() {
  if (!ready()) return;
  tone(420, ctx.currentTime, 0.18, { type: "triangle", vol: 0.08, to: 980 });
}

// Crackly static while a reply is "travelling" across space.
export function startStatic() {
  if (!ready() || staticNode) return;
  const n = noiseSource();
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1800;
  bp.Q.value = 1.4;
  const g = ctx.createGain();
  g.gain.value = 0;
  g.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 0.2);
  // Crackle: a fast random-ish wobble on the volume.
  const lfo = ctx.createOscillator();
  lfo.type = "square";
  lfo.frequency.value = 13;
  const lg = ctx.createGain();
  lg.gain.value = 0.02;
  lfo.connect(lg).connect(g.gain);
  n.connect(bp).connect(g).connect(master);
  n.start();
  lfo.start();
  staticNode = { n, lfo, g };
}

export function stopStatic() {
  if (!staticNode) return;
  const { n, lfo, g } = staticNode;
  staticNode = null;
  const t = ctx.currentTime;
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(g.gain.value, t);
  g.gain.linearRampToValueAtTime(0, t + 0.15);
  n.stop(t + 0.2);
  lfo.stop(t + 0.2);
}

// Two-tone "message received" chirp, like a probe's beacon.
export function incoming() {
  if (!ready()) return;
  const t = ctx.currentTime;
  tone(880, t, 0.12, { vol: 0.08 });
  tone(1320, t + 0.13, 0.2, { vol: 0.08 });
}

export function fanfare() {
  if (!ready()) return;
  const t = ctx.currentTime;
  [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.14, 0.5, { type: "triangle", vol: 0.09 }));
}

// Lower the hum while a NASA recording plays.
export function duck(on) {
  if (!ambient) return;
  const t = ctx.currentTime;
  ambient.gain.cancelScheduledValues(t);
  ambient.gain.setValueAtTime(ambient.gain.value, t);
  ambient.gain.linearRampToValueAtTime(on ? 0.15 : 0.9, t + 0.4);
}

// ---------- Machine voices ----------
const stripEmoji = (s) => s.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "").replace(/\s+/g, " ").trim();
let voices = [];
const loadVoices = () => (voices = window.speechSynthesis?.getVoices() ?? []);
if ("speechSynthesis" in window) {
  loadVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
}

export function speak(text, { pitch = 1, rate = 1 } = {}) {
  if (!enabled || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(stripEmoji(text));
  const en = voices.filter((v) => v.lang?.startsWith("en"));
  u.voice = en.find((v) => /Google US English|Microsoft (Guy|Mark|David)/i.test(v.name)) || en[0] || null;
  u.pitch = pitch;
  u.rate = rate;
  u.volume = 0.9;
  window.speechSynthesis.speak(u);
}

export function hush() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

export function setSound(on) {
  enabled = on;
  try {
    localStorage.setItem("lsom-sound", on ? "on" : "off");
  } catch {
    /* ignore */
  }
  if (on) wake();
  if (master) master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.05);
  if (!on) {
    hush();
    stopStatic();
  }
  for (const fn of listeners) fn(on);
}
