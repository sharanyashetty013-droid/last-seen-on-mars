import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource-variable/inter";
import "lenis/dist/lenis.css";
import Lenis from "lenis";
import "./style.css";
import { machines, worlds, fallbackReplies, exhibit } from "./machines.js";
import * as sound from "./sound.js";
import { createScene, SITES } from "./scene.js";

const $ = (id) => document.getElementById(id);
const messages = $("messages");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- The 3D scene ----------
let world = null;
// ---------- Chat ----------
let current = null;
const history = {};
const busy = {};
const GLYPHS = "▖▗▘▙▚▛▜▝▞▟░▒";

const loaded = {};
function loadImage(src) {
  if (!loaded[src]) {
    loaded[src] = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = src;
    });
  }
  return loaded[src];
}

async function setPhotos(m) {
  const ok = await loadImage(m.portrait.file);
  if (current !== m) return;
  const banner = $("banner");
  banner.classList.toggle("has-photo", ok);
  $("banner-img").style.backgroundImage = ok ? `url("${m.portrait.file}")` : "";
  const av = $("chat-avatar");
  av.style.backgroundImage = ok ? `url("${m.portrait.file}")` : "";
  av.textContent = ok ? "" : m.emoji;
  $("banner-credit").innerHTML = ok
    ? `Photo: ${m.portrait.caption}. <a href="${m.portrait.link}" target="_blank" rel="noopener noreferrer">${m.portrait.credit}</a>`
    : "";
}

function openChat(m) {
  current = m;
  document.body.classList.add("chatting");
  document.body.dataset.world = m.world;
  $("panel").hidden = false;
  document.documentElement.classList.add("locked");
  lenis?.stop();
  $("chat-name").textContent = m.name;
  $("chat-status").textContent = `${m.where.replace(" · ", ", ")}. ${m.lastSeen}.`;
  $("chat-avatar").style.setProperty("--c", m.color);
  $("banner").style.setProperty("--c", m.color);
  setPhotos(m);
  world?.focusMachine(m, true);
  sound.tuneIn();
  startDelayText(m);

  if (!history[m.id]) {
    history[m.id] = [];
    renderMessages();
    machineSays(m, m.hello);
  } else {
    renderMessages();
  }
  renderChips();
  if (window.innerWidth >= 760) $("input").focus({ preventScroll: true });
}

function closeChat() {
  current = null;
  sound.hush();
  sound.stopStatic();
  stopVoiceNote();
  clearInterval(delayTimer);
  document.body.classList.remove("chatting");
  delete document.body.dataset.world;
  $("panel").hidden = true;
  document.documentElement.classList.remove("locked");
  lenis?.start();
  showChapter(chapterNow, true);
}

function renderMessages() {
  messages.innerHTML = "";
  for (const msg of history[current.id]) {
    addBubble(msg.from, msg.text);
    if (msg.audio) addVoiceNote(msg.audio);
  }
  if (busy[current.id]) showSignal();
}

function decode(node, text) {
  if (reduceMotion) {
    node.textContent = text;
    return;
  }
  let i = 0;
  const step = Math.max(1, Math.round(text.length / 45));
  const timer = setInterval(() => {
    i = Math.min(text.length, i + step);
    const tail = text
      .slice(i, i + 4)
      .split("")
      .map((c) => (c === " " ? " " : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
      .join("");
    node.textContent = text.slice(0, i) + tail;
    if (i >= text.length) {
      node.textContent = text;
      clearInterval(timer);
    }
    messages.scrollTop = messages.scrollHeight;
  }, 22);
}

function addBubble(from, text, animate = false) {
  const div = document.createElement("div");
  div.className = `bubble ${from}`;
  const body = document.createElement("span");
  div.appendChild(body);
  if (animate) decode(body, text);
  else body.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function showSignal() {
  const div = document.createElement("div");
  div.className = "signal";
  div.id = "signal";
  const from = { mars: "Mars", moon: "the Moon", deep: "deep space" }[current.world];
  div.innerHTML = `<span class="signal-waves"><i></i><i></i><i></i></span>Receiving signal from ${from}`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function machineSays(m, text, audio = null) {
  busy[m.id] = true;
  if (current === m) {
    showSignal();
    sound.startStatic();
  }
  const delay = Math.min(2200, 700 + text.length * 16);
  setTimeout(() => {
    busy[m.id] = false;
    history[m.id].push({ from: "them", text, audio });
    if (current === m) {
      $("signal")?.remove();
      sound.stopStatic();
      sound.incoming();
      addBubble("them", text, true);
      if (audio) addVoiceNote(audio);
      renderChips();
    }
  }, delay);
}

// ---------- Voice notes: real NASA recordings ----------
const audioOK = {};
function findAudio(item) {
  // Use the first file of the recording that actually exists in public/audio.
  const key = item.files.join("|");
  if (!(key in audioOK)) {
    audioOK[key] = (async () => {
      for (const f of item.files) {
        try {
          const r = await fetch(f, { method: "HEAD" });
          const type = r.headers.get("content-type") || "";
          if (r.ok && !type.includes("text/html")) return f;
        } catch {
          /* try the next one */
        }
      }
      return null;
    })();
  }
  return audioOK[key];
}

const sent = {};
async function nextVoiceNote(m) {
  for (const item of m.audio || []) {
    if (sent[m.id]?.includes(item)) continue;
    if (await findAudio(item)) return item;
  }
  return null;
}

const player = new Audio();
player.preload = "none";
let playingBtn = null;

function stopVoiceNote() {
  player.pause();
  if (playingBtn) playingBtn.closest(".voice").classList.remove("playing");
  playingBtn = null;
  sound.duck(false);
}

player.addEventListener("timeupdate", () => {
  if (!playingBtn || !player.duration) return;
  playingBtn.closest(".voice").style.setProperty("--p", `${(player.currentTime / player.duration) * 100}%`);
  playingBtn.closest(".voice").querySelector(".vn-time").textContent = fmtTime(player.duration - player.currentTime);
});
player.addEventListener("ended", () => {
  if (playingBtn) {
    playingBtn.textContent = "▶";
    playingBtn.closest(".voice").style.setProperty("--p", "0%");
  }
  stopVoiceNote();
});

const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

async function addVoiceNote(item) {
  const div = document.createElement("div");
  div.className = "bubble them voice";
  const bars = Array.from({ length: 28 }, (_, i) => {
    const h = 25 + Math.round(70 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)));
    return `<i style="height:${h}%"></i>`;
  }).join("");
  div.innerHTML = `<button class="vn-play" type="button" aria-label="Play NASA recording">▶</button><span class="vn-wave">${bars}</span><span class="vn-time">🎧</span><small class="vn-credit">Real NASA recording, <a href="${item.link}" target="_blank" rel="noopener noreferrer">${item.credit}</a></small>`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  const btn = div.querySelector(".vn-play");
  const file = await findAudio(item);
  btn.addEventListener("click", () => {
    if (playingBtn === btn && !player.paused) {
      player.pause();
      btn.textContent = "▶";
      div.classList.remove("playing");
      sound.duck(false);
      return;
    }
    stopVoiceNote();
    if (playingBtn && playingBtn !== btn) playingBtn.textContent = "▶";
    sound.hush();
    if (player.src !== new URL(file, location.href).href) player.src = file;
    player.play().catch(() => {});
    playingBtn = btn;
    btn.textContent = "❚❚";
    div.classList.add("playing");
    sound.duck(true);
  });
}

// ---------- Live distance for Voyager 1 ----------
// One light-day (light travels 299,792.458 km/s for 86,400 s) is reached on
// 18 Nov 2026 06:16:07 UTC (NASA/JPL). Voyager 1 moves away at roughly 17 km/s.
const LIGHT_DAY_KM = 299792.458 * 86400;
const LIGHT_DAY_AT = Date.UTC(2026, 10, 18, 6, 16, 7);
let delayTimer = null;
function startDelayText(m) {
  clearInterval(delayTimer);
  const el = $("chat-delay");
  if (m.id !== "voyager1") {
    el.textContent = `Messages take ${worlds[m.world].delay} to arrive`;
    return;
  }
  const tick = () => {
    const km = LIGHT_DAY_KM + ((Date.now() - LIGHT_DAY_AT) / 1000) * 17;
    el.innerHTML = `<b class="live">● Live</b> about ${Math.round(km).toLocaleString("en-US")} km from Earth`;
  };
  tick();
  delayTimer = setInterval(tick, 200);
}

async function renderChips() {
  const m = current;
  const chips = $("chips");
  chips.innerHTML = "";
  const note = await nextVoiceNote(m);
  if (current !== m) return;
  if (note) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip-voice";
    b.textContent = "🎧 Send me a sound";
    b.addEventListener("click", () => askForSound(m, note));
    chips.appendChild(b);
  }
  for (const c of m.chips) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = c.q;
    b.addEventListener("click", () => ask(c.q));
    chips.appendChild(b);
  }
}

function askForSound(m, note) {
  if (busy[m.id]) return;
  (sent[m.id] ||= []).push(note);
  const text = "Send me a sound!";
  history[m.id].push({ from: "me", text });
  addBubble("me", text);
  sound.send();
  reached(m);
  machineSays(m, note.text, note);
}

function replyFor(m, question) {
  const q = question.toLowerCase().trim();
  const chip = m.chips.find((c) => c.q.toLowerCase() === q);
  if (chip) return chip.a;
  const words = q.replace(/[^a-z0-9 ]/g, " ");
  for (const c of m.chips) {
    const key = c.q.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(" ").filter((w) => w.length > 3);
    if (key.length && key.every((w) => words.includes(w))) return c.a;
  }
  for (const kw of m.keywords || []) {
    if (kw.k.some((k) => q.includes(k))) return kw.a;
  }
  if (/^(hi|hello|hey|hii+)\b/.test(q)) return "Hi there! 👋 Ask me about my mission!";
  return fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
}

function ask(text) {
  if (!current || busy[current.id] || !text.trim()) return;
  history[current.id].push({ from: "me", text });
  addBubble("me", text);
  sound.send();
  reached(current);
  machineSays(current, replyFor(current, text));
}

// ---------- Mission: reach all 8 machines ----------
const reachedSet = new Set();
function renderMission() {
  const dots = $("mission-dots");
  dots.innerHTML = machines
    .map((m) => `<i class="${reachedSet.has(m.id) ? "on" : ""}" style="--c:${m.color}" title="${m.name}"></i>`)
    .join("");
  const n = reachedSet.size;
  $("mission-text").textContent =
    n === machines.length ? "Complete. Get your certificate" : `${n} of ${machines.length} reached`;
  $("mission").classList.toggle("done", n === machines.length);
}

function reached(m) {
  if (reachedSet.has(m.id)) return;
  reachedSet.add(m.id);
  renderMission();
  const btn = $("mission");
  btn.classList.remove("bump");
  void btn.offsetWidth;
  btn.classList.add("bump");
  if (reachedSet.size === machines.length) {
    setTimeout(() => {
      sound.fanfare();
      openCertificate();
    }, 3500);
  }
}

$("mission").addEventListener("click", () => {
  closeMenu();
  if (reachedSet.size === machines.length) return openCertificate();
  const next = machines.find((m) => !reachedSet.has(m.id) && m !== current) || machines.find((m) => !reachedSet.has(m.id));
  if (next) openChat(next);
});

// ---------- Mission Control certificate ----------
const cert = $("cert");
const canvas = $("cert-canvas");
function drawCertificate() {
  const c = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const name = $("cert-name").value.trim() || "Space Explorer";
  c.fillStyle = "#05060c";
  c.fillRect(0, 0, W, H);
  let seed = 9;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 380; i++) {
    c.globalAlpha = 0.2 + r() * 0.8;
    c.fillStyle = "#fff";
    c.beginPath();
    c.arc(r() * W, r() * H, r() * 1.3, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;
  const mars = c.createRadialGradient(W - 300, H - 330, 20, W - 160, H - 160, 360);
  mars.addColorStop(0, "#f2a476");
  mars.addColorStop(0.5, "#a8431d");
  mars.addColorStop(1, "#1a0904");
  c.fillStyle = mars;
  c.beginPath();
  c.arc(W - 130, H - 120, 300, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "rgba(255,255,255,0.18)";
  c.lineWidth = 1;
  c.strokeRect(48, 48, W - 96, H - 96);
  c.fillStyle = "#a7a3b5";
  c.font = "500 18px 'Inter Variable', Inter, sans-serif";
  c.fillText("Last Seen on Mars, mission log", 100, 130);
  c.fillStyle = "#f2efe9";
  c.font = "400 92px 'Instrument Serif', Georgia, serif";
  c.fillText("Certificate of contact", 96, 230);
  c.fillStyle = "#a7a3b5";
  c.font = "400 24px 'Inter Variable', Inter, sans-serif";
  c.fillText("Presented to", 100, 310);
  c.fillStyle = "#f3b48a";
  c.font = "italic 400 84px 'Instrument Serif', Georgia, serif";
  c.fillText(name, 96, 395);
  c.fillStyle = "#c9c5d4";
  c.font = "400 23px 'Inter Variable', Inter, sans-serif";
  c.fillText("for reaching all eight machines humanity left on the Moon,", 100, 455);
  c.fillText("on Mars and in interstellar space.", 100, 488);
  machines.forEach((m, i) => {
    const x = 100 + (i % 2) * 330;
    const y = 560 + Math.floor(i / 2) * 36;
    c.fillStyle = m.status === "duty" ? "#7ee2a8" : "#f3b48a";
    c.beginPath();
    c.arc(x + 5, y - 7, 4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#f2efe9";
    c.font = "400 20px 'Inter Variable', Inter, sans-serif";
    c.fillText(m.name, x + 20, y);
  });
  c.fillStyle = "#77738a";
  c.font = "400 16px 'Inter Variable', Inter, sans-serif";
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  c.fillText(`${date}, NASA Space Apps Challenge 2026`, 100, H - 90);
}

function openCertificate() {
  drawCertificate();
  if (!cert.open) cert.showModal();
}
$("cert-name").addEventListener("input", drawCertificate);
$("cert-close").addEventListener("click", () => cert.close());
$("cert-download").addEventListener("click", () => {
  drawCertificate();
  const a = document.createElement("a");
  a.download = "mission-control-certificate.png";
  a.href = canvas.toDataURL("image/png");
  a.click();
});

// ---------- Sound switch ----------
const soundBtn = $("sound");
const paintSound = (on) => {
  soundBtn.innerHTML = on
    ? '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 10v4M9 7v10M13 4v16M17 8v8M21 11v2"/></g></svg>'
    : '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 12h16"/></g></svg>';
  soundBtn.setAttribute("aria-label", on ? "Sound on. Turn sound off" : "Sound off. Turn sound on");
  soundBtn.setAttribute("aria-pressed", String(on));
};
paintSound(sound.soundOn());
sound.onSoundChange(paintSound);
soundBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  sound.setSound(!sound.soundOn());
});
const wakeOnce = () => sound.wake();
window.addEventListener("pointerdown", wakeOnce, { once: true });
window.addEventListener("keydown", wakeOnce, { once: true });

$("form").addEventListener("submit", (e) => {
  e.preventDefault();
  ask($("input").value);
  $("input").value = "";
});
$("panel-close").addEventListener("click", closeChat);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && current && !$("photo").open && !$("cert").open) closeChat();
});


// ---------- Where am I? ----------
const dialog = $("photo");
const img = $("photo-img");
$("where").addEventListener("click", () => {
  const p = current.photo;
  $("photo-title").textContent = p.title;
  $("photo-caption").textContent = p.caption;
  $("photo-credit").textContent = `Image: ${p.credit}`;
  $("photo-link").href = p.link;
  $("photo-missing").hidden = true;
  img.hidden = false;
  img.alt = `${current.name}, seen in a NASA photo`;
  img.src = p.file;
  dialog.showModal();
});
img.addEventListener("error", () => {
  img.hidden = true;
  $("photo-missing").hidden = false;
});
$("photo-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) dialog.close();
});

renderMission();
try {
  world = createScene({ canvas: $("gl"), labelsEl: $("pins"), machines, onPick: (m) => openChat(m) });
} catch (err) {
  // No WebGL: show a simple list of machines instead.
  console.error(err);
  document.body.classList.add("no-3d");
  $("pins").innerHTML = machines.map((m) => `<button type="button" class="pin-flat" data-id="${m.id}">${m.name}</button>`).join("");
  $("pins").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => openChat(machines.find((m) => m.id === b.dataset.id))));
}

// ---------- The scroll story ----------
const order = machines.map((m) => ({ m, e: exhibit[m.id] })).sort((a, b) => a.e.order - b.e.order);
let chapterNow = null;

function fmtStat(st, value) {
  if (st.year) return String(Math.round(value));
  const v = st.dec ? value.toFixed(st.dec) : Math.round(value).toLocaleString("en-US");
  return v;
}

function buildChapters() {
  const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  $("chapters").innerHTML = order
    .map(
      ({ m, e }, i) => `
    <section class="chapter c-${m.world}" id="ch-${m.id}" data-id="${m.id}" data-sky="${m.world}">
      <div class="ch-card">
        <figure class="ch-photo">
          <img loading="lazy" src="${m.portrait.file}" alt="${esc(m.portrait.caption)}" />
          <figcaption>${esc(m.portrait.credit)}</figcaption>
        </figure>
        <p class="ch-meta">${esc(m.where.split(" · ")[1] ? `${m.where.split(" · ")[1]}, ${e.place === "The Moon" ? "the Moon" : e.place}` : e.place)}</p>
        <p class="ch-year" aria-hidden="true">${e.year}</p>
        <h2>${esc(m.name)}</h2>
        <p class="ch-headline">${esc(e.headline)}</p>
        ${m.world === "mars" ? `<p class="ch-local"><i></i>Local Mars time at this spot right now: <b data-mars-lon="${SITES[m.id].lon}">--:--</b></p>` : ""}
        <div class="ch-stats">
          ${e.stats
            .map(
              (st) =>
                `<div class="stat"><b><small>${st.pre || ""}</small><span data-count="${st.n}" data-i="${e.stats.indexOf(st)}">0</span><small>${st.unit ? (st.unit === "+" ? "+" : " " + st.unit) : ""}</small></b><span>${esc(st.label)}</span></div>`,
            )
            .join("")}
        </div>
        <div class="ch-rec" data-rec hidden>
          <button type="button" class="ch-rec-play" aria-label="Play the NASA recording"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 5l12 7-12 7z" fill="currentColor"/></svg></button>
          <div class="ch-rec-body">
            <span class="ch-rec-title"></span>
            <span class="ch-rec-bar"><i></i></span>
          </div>
          <span class="ch-rec-time">Real recording</span>
        </div>
        <div class="ch-actions">
          <button type="button" class="btn-primary" data-talk>Talk to ${esc(m.name.replace("Apollo 17 ", "the ").replace("Apollo 11 ", "the "))}</button>
          <button type="button" class="btn-ghost" data-orbit>Seen from orbit</button>
        </div>
      </div>
    </section>`,
    )
    .join("");

  for (const { m } of order) {
    const sec = $(`ch-${m.id}`);
    sec.querySelector("[data-talk]").addEventListener("click", () => openChat(m));
    sec.querySelector("[data-orbit]").addEventListener("click", () => {
      const prev = current;
      current = m;
      $("where").click();
      current = prev;
    });
    const img = sec.querySelector(".ch-photo img");
    img.addEventListener("error", () => sec.querySelector(".ch-photo").classList.add("no-img"));
    // Inline player: the real NASA recording plays right inside the card
    const rec = sec.querySelector("[data-rec]");
    const item = (m.audio || [])[0];
    if (item) {
      findAudio(item).then((file) => {
        if (!file) return;
        rec.hidden = false;
        rec.querySelector(".ch-rec-title").textContent = REC_TITLES[m.id] || "NASA recording";
        rec.querySelector(".ch-rec-play").addEventListener("click", () => toggleCardAudio(rec, file));
      });
    }
  }

  // Menu list
  $("menu-list").innerHTML = order
    .map(({ m, e }) => `<li><a href="#ch-${m.id}" data-close><span>${e.year}</span>${m.name}</a></li>`)
    .join("");

  // Chapter rail
  $("rail").innerHTML = order
    .map(({ m, e }) => `<a href="#ch-${m.id}" data-for="${m.id}" title="${m.name}"><i></i><span>${e.year}</span></a>`)
    .join("");

  // Watch which section is on screen.
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        const id = en.target.dataset.id || en.target.id || "top";
        showChapter(id);
        countUp(en.target);
        en.target.classList.add("in");
      }
    },
    { threshold: 0.4 },
  );
  document.querySelectorAll("#story > section, .chapter").forEach((s) => io.observe(s));
}

function showChapter(id, force = false) {
  if (id === chapterNow && !force) return;
  chapterNow = id;
  applyStorm(id === "dust" ? dustLevel || 0 : 0);
  const sec = id === "top" ? $("top") : $(`ch-${id}`) || $(id) || $("top");
  document.body.dataset.sky = sec.dataset.sky || "mars";
  document.querySelectorAll("#rail a").forEach((a) => a.classList.toggle("on", a.dataset.for === id));
  if (current) return; // chat is open; leave the camera on that machine
  const m = machines.find((x) => x.id === id);
  if (m) world?.focusMachine(m, false, "text");
  else if (id === "finale") world?.focusMachine(machines.find((x) => x.id === "voyager1"), false, "finale");
  else if (id === "top") world?.heroView();
  else if (id === "lab") world?.skyView();
  else if (id === "dust") world?.focusMachine(machines.find((x) => x.id === "opportunity"), false, "dust");
  else if (id === "lifespan") world?.skyView();
  else if (id === "numbers") world?.skyView();
  else world?.overview();
}

const counted = new WeakSet();
function countUp(sec) {
  if (counted.has(sec)) return;
  counted.add(sec);
  const m = machines.find((x) => x.id === sec.dataset.id);
  sec.querySelectorAll("[data-count]").forEach((el) => {
    const target = parseFloat(el.dataset.count);
    const st = m ? exhibit[m.id].stats[+el.dataset.i] : { dec: 0 };
    const t0 = performance.now();
    const dur = reduceMotion ? 0 : 1400;
    const step = (now) => {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1;
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmtStat(st, st.year ? target : target * e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

// Live Voyager distance in the finale
setInterval(() => {
  const km = LIGHT_DAY_KM + ((Date.now() - LIGHT_DAY_AT) / 1000) * 17;
  $("finale-km").textContent = Math.round(km).toLocaleString("en-US");
}, 200);



buildChapters();
showChapter("top");

// ---------- Smooth scrolling ----------
let lenis = null;
if (!reduceMotion) {
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
  const raf = (time) => {
    lenis.raf(time);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
  document.querySelectorAll('a[href^="#"]').forEach((a) =>
    a.addEventListener("click", (e) => {
      const target = document.querySelector(a.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { duration: 1.6 });
    }),
  );
}
document.addEventListener("click", (e) => {
  const a = e.target.closest?.("#rail a");
  if (!a || !lenis) return;
  e.preventDefault();
  lenis.scrollTo(document.querySelector(a.getAttribute("href")), { duration: 1.6 });
});

// Reading progress line in the top bar
const progressLine = $("progress-line");
const updateProgress = () => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progressLine.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
};
window.addEventListener("scroll", updateProgress, { passive: true });
updateProgress();

// ---------- Glossy cards: a light sheen follows the pointer, and the card tilts a little ----------
const fine = window.matchMedia("(pointer: fine)").matches;
if (fine && !reduceMotion) {
  document.addEventListener("pointermove", (e) => {
    const card = e.target.closest?.(".ch-card, .num, .btn-primary");
    document.querySelectorAll(".tilt-on").forEach((c) => {
      if (c !== card) {
        c.classList.remove("tilt-on");
        c.style.transform = "";
      }
    });
    if (!card) return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    card.style.setProperty("--mx", `${x * 100}%`);
    card.style.setProperty("--my", `${y * 100}%`);
    if (!card.classList.contains("btn-primary")) {
      card.classList.add("tilt-on");
      card.style.transform = `perspective(1100px) rotateY(${(x - 0.5) * 5}deg) rotateX(${(0.5 - y) * 5}deg)`;
    }
  });
}
document.body.classList.add("loaded");

// ---------- Menu ----------
const menu = $("menu");
const menuBtn = $("menu-btn");
function openMenu() {
  menu.hidden = false;
  requestAnimationFrame(() => menu.classList.add("open"));
  menuBtn.setAttribute("aria-expanded", "true");
  menuBtn.setAttribute("aria-label", "Close menu");
  document.body.classList.add("menu-open");
}
function closeMenu() {
  if (menu.hidden) return;
  menu.classList.remove("open");
  menuBtn.setAttribute("aria-expanded", "false");
  menuBtn.setAttribute("aria-label", "Open menu");
  document.body.classList.remove("menu-open");
  setTimeout(() => (menu.hidden = true), 250);
}
menuBtn.addEventListener("click", () => (menu.hidden ? openMenu() : closeMenu()));
menu.addEventListener("click", (e) => {
  if (e.target === menu || e.target.closest("[data-close]")) closeMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu();
});

// ---------- Local Mars time at each landing site ----------
// Mars Sol Date from Allison and McEwen (2000), as NASA GISS Mars24 uses it.
function marsLocalTime(lonEast, now = Date.now()) {
  const jdUT = now / 86400000 + 2440587.5;
  const jdTT = jdUT + 69.184 / 86400;
  const msd = (jdTT - 2405522.0028779) / 1.0274912517;
  const mtc = (24 * msd) % 24;
  const lmst = (((mtc + lonEast / 15) % 24) + 24) % 24;
  const h = Math.floor(lmst);
  const min = Math.floor((lmst - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
function tickMarsClocks() {
  document.querySelectorAll("[data-mars-lon]").forEach((el) => (el.textContent = marsLocalTime(+el.dataset.marsLon)));
}
tickMarsClocks();
setInterval(tickMarsClocks, 5000);

// ---------- Signal lab ----------
// Where Earth and Mars are today, from JPL's "Keplerian Elements for Approximate Positions of the Major Planets".
function planetXYZ(el, T) {
  const rad = Math.PI / 180;
  const a = el.a[0] + el.a[1] * T;
  const e = el.e[0] + el.e[1] * T;
  const I = (el.I[0] + el.I[1] * T) * rad;
  const L = el.L[0] + el.L[1] * T;
  const w = el.w[0] + el.w[1] * T;
  const O = (el.O[0] + el.O[1] * T) * rad;
  const peri = (w - el.O[0] - el.O[1] * T) * rad;
  let M = ((((L - w) % 360) + 540) % 360) - 180;
  M *= rad;
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 6; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(peri), sw = Math.sin(peri), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(I), sI = Math.sin(I);
  return [
    (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    sw * sI * xp + cw * sI * yp,
  ];
}
const EARTH_EL = { a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], I: [-0.00001531, -0.01294668], L: [100.46457166, 35999.37244981], w: [102.93768193, 0.32327364], O: [0, 0] };
const MARS_EL = { a: [1.52371034, 0.00001847], e: [0.0933941, 0.00007882], I: [1.84969142, -0.00813131], L: [-4.55343205, 19140.30268499], w: [-23.94362959, 0.44441088], O: [49.55953891, -0.29257343] };
const AU = 149597870.7;
const C = 299792.458;
function marsDistanceKm(now = Date.now()) {
  const T = (now / 86400000 + 2440587.5 - 2451545.0) / 36525;
  const e = planetXYZ(EARTH_EL, T);
  const m = planetXYZ(MARS_EL, T);
  return Math.hypot(m[0] - e[0], m[1] - e[1], m[2] - e[2]) * AU;
}
const targets = {
  moon: { name: "The Moon", km: () => 384400, playMs: 1300 },
  mars: { name: "Mars", km: () => marsDistanceKm(), playMs: 5000 },
  voyager: { name: "Voyager 1", km: () => LIGHT_DAY_KM + ((Date.now() - LIGHT_DAY_AT) / 1000) * 17, playMs: 7000 },
};
let labTarget = "moon";
const fmtDur = (sec) => {
  if (sec < 60) return `${sec.toFixed(2)} seconds`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min ${Math.round(sec % 60)} s`;
  return `${Math.floor(sec / 3600)} h ${Math.round((sec % 3600) / 60)} min`;
};
function renderLab() {
  const t = targets[labTarget];
  const km = t.km();
  const sec = km / C;
  $("lab-dist").textContent = `${Math.round(km).toLocaleString("en-US")} km`;
  $("lab-time").textContent = fmtDur(sec);
  const back = new Date(Date.now() + sec * 2000);
  $("lab-back").textContent =
    sec * 2 > 43200
      ? back.toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })
      : back.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  $("lab-far").textContent = t.name;
}
document.querySelectorAll(".lab-targets button").forEach((b) =>
  b.addEventListener("click", () => {
    labTarget = b.dataset.target;
    document.querySelectorAll(".lab-targets button").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    $("lab-pulse").getAnimations().forEach((a) => a.cancel());
    $("lab-status").textContent = "";
    renderLab();
  }),
);
renderLab();
setInterval(renderLab, 1000);
$("lab-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const t = targets[labTarget];
  const msg = $("lab-msg").value.trim() || "Hello from Earth";
  const sec = t.km() / C;
  const pulse = $("lab-pulse");
  pulse.getAnimations().forEach((a) => a.cancel());
  sound.send();
  const real = labTarget === "moon";
  $("lab-status").textContent = real
    ? `"${msg}" is on its way. Shown in real time.`
    : `"${msg}" is on its way. Shown ${Math.round((sec * 1000) / t.playMs).toLocaleString("en-US")} times faster than real life.`;
  const anim = pulse.animate([{ left: "0%", opacity: 1 }, { left: "100%", opacity: 1 }], {
    duration: reduceMotion ? 1 : t.playMs,
    easing: "linear",
    fill: "forwards",
  });
  anim.onfinish = () => {
    sound.incoming();
    $("lab-status").textContent = `"${msg}" reached ${t.name}. In real life that took ${fmtDur(sec)}.`;
  };
});

// ---------- Recordings played inside the chapter cards ----------
const REC_TITLES = {
  insight: "Wind on Mars, heard by InSight",
  ingenuity: "Ingenuity's rotors, heard by Perseverance",
  mirror: "\u201cThe Eagle has landed,\u201d July 1969",
  voyager1: "The sound of interstellar space",
};
const cardAudio = new Audio();
let cardRec = null;
const PLAY = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 5l12 7-12 7z" fill="currentColor"/></svg>';
const PAUSE = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor"/></svg>';
function resetCardRec() {
  if (!cardRec) return;
  cardRec.classList.remove("playing");
  cardRec.querySelector(".ch-rec-play").innerHTML = PLAY;
  sound.duck(false);
}
function toggleCardAudio(rec, file) {
  if (cardRec === rec && !cardAudio.paused) {
    cardAudio.pause();
    resetCardRec();
    return;
  }
  resetCardRec();
  if (cardRec !== rec) {
    cardAudio.src = file;
    cardRec = rec;
  }
  sound.hush();
  sound.duck(true);
  cardAudio.play().catch(() => {});
  rec.classList.add("playing");
  rec.querySelector(".ch-rec-play").innerHTML = PAUSE;
  const m = machines.find((x) => `ch-${x.id}` === rec.closest(".chapter").id);
  if (m) reached(m);
}
cardAudio.addEventListener("timeupdate", () => {
  if (!cardRec || !cardAudio.duration) return;
  cardRec.style.setProperty("--p", `${(cardAudio.currentTime / cardAudio.duration) * 100}%`);
  const left = cardAudio.duration - cardAudio.currentTime;
  cardRec.querySelector(".ch-rec-time").textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")}`;
});
cardAudio.addEventListener("ended", () => {
  cardRec?.style.setProperty("--p", "0%");
  resetCardRec();
});

// ---------- Dust storm simulator ----------
// Two real readings from Opportunity: ~645 Wh/sol on 1 June 2018 and 22 Wh/sol at tau 10.8 on 10 June 2018.
// In between we use a simple exponential curve through those two points. ~120 Wh is the survival line.
const P0 = 645;
const TAU0 = 0.5;
const K = Math.log(P0 / 22) / (10.8 - TAU0);
const SURVIVE = 120;
const power = (tau) => P0 * Math.exp(-K * (tau - TAU0));
const mix = (a, b, t) => {
  const pa = a.match(/\w\w/g).map((h) => parseInt(h, 16));
  const pb = b.match(/\w\w/g).map((h) => parseInt(h, 16));
  return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("");
};
function setDust(tau) {
  const t = (tau - TAU0) / (10.8 - TAU0);
  const p = power(tau);
  $("dust-range").value = tau;
  $("dust-tau").textContent = tau.toFixed(1);
  $("dust-wh").textContent = Math.round(p);
  $("dust-sunpct").textContent = `${Math.max(1, Math.round((p / P0) * 100))}%`;
  $("dust-bar").style.width = `${(p / P0) * 100}%`;
  $("dust-bar").classList.toggle("low", p < SURVIVE * 1.6);
  $("dust-bar").classList.toggle("dead", p < SURVIVE);
  $("dust-state").textContent =
    p >= 400
      ? "A normal day. Plenty of power for science."
      : p >= SURVIVE * 1.6
        ? "Getting dark. The team pauses science to save power."
        : p >= SURVIVE
          ? "Barely enough to stay warm and alive. This is how it survived the 2007 storm."
          : "Below what it needs to survive. The rover shuts down and waits for the sky to clear.";
  dustLevel = t;
  if (chapterNow === "dust") applyStorm(t);
}
$("dust-range").addEventListener("input", (e) => setDust(+e.target.value));
let dustAnim = null;
$("dust-play").addEventListener("click", () => {
  cancelAnimationFrame(dustAnim);
  const t0 = performance.now();
  const dur = reduceMotion ? 1 : 7000;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    setDust(TAU0 + (10.8 - TAU0) * (k * k));
    if (k < 1) dustAnim = requestAnimationFrame(step);
  };
  dustAnim = requestAnimationFrame(step);
});
setDust(0.5);
var dustLevel = 0; // var: setDust can run before this line
function applyStorm(t) {
  $("storm").style.opacity = String(t);
  world?.setDust(t);
}
// ---------- Planned vs actually lived ----------
const DAY = 86400000;
const lives = [
  { name: "Opportunity", planned: 92, plannedText: "90 Martian days", from: "2004-01-25", to: "2018-06-10" },
  { name: "Spirit", planned: 92, plannedText: "90 Martian days", from: "2004-01-04", to: "2010-03-22" },
  { name: "Ingenuity", planned: 31, plannedText: "30 Martian days, 5 flights", from: "2021-04-19", to: "2024-01-18", extra: "72 flights" },
  { name: "Voyager 1", planned: 1826, plannedText: "5 years", from: "1977-09-05", to: null },
  { name: "InSight", planned: 728, plannedText: "1 Mars year", from: "2018-11-26", to: "2022-12-15" },
  { name: "Apollo 11 Laser Mirror", planned: null, plannedText: "no end date", from: "1969-07-21", to: null },
];
const LMIN = Math.log10(10);
const LMAX = Math.log10(30000);
const pos = (d) => ((Math.log10(Math.max(10, d)) - LMIN) / (LMAX - LMIN)) * 100;
const fmtSpan = (d) => (d < 365 ? `${Math.round(d)} days` : `${(d / 365.25).toFixed(d < 3650 ? 1 : 0)} years`);
function renderLives() {
  const now = Date.now();
  $("life").innerHTML = lives
    .map((l) => {
      const days = ((l.to ? Date.parse(l.to) : now) - Date.parse(l.from)) / DAY;
      const ratio = l.planned ? days / l.planned : null;
      return `<div class="life-row${l.to ? "" : " live"}">
        <p class="life-name">${l.name}</p>
        <p class="life-planned">Planned<br /><s>${l.plannedText}</s></p>
        <p class="life-lived">${fmtSpan(days)}${l.to ? "" : "<small>and counting</small>"}${l.extra ? `<small>${l.extra}</small>` : ""}</p>
        <p class="life-x">${ratio ? `${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}×` : "No end"}<small>${ratio ? "longer than planned" : "still in use"}</small></p>
      </div>`;
    })
    .join("");
}
renderLives();
