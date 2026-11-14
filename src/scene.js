// The 3D scene: Earth, the Moon, Mars and Voyager 1, with every machine pinned
// at its real latitude and longitude. Built with Three.js.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

// Real landing sites (degrees; east longitude positive).
export const SITES = {
  opportunity: { body: "mars", lat: -1.95, lon: -5.53 },
  spirit: { body: "mars", lat: -14.57, lon: 175.47 },
  ingenuity: { body: "mars", lat: 18.43, lon: 77.45 },
  insight: { body: "mars", lat: 4.5, lon: 135.62 },
  mirror: { body: "moon", lat: 0.67, lon: 23.47 },
  lrv: { body: "moon", lat: 20.19, lon: 30.77 },
  surveyor3: { body: "moon", lat: -3.01, lon: -23.42 },
};

// Wide screens get a left-to-right layout; tall phone screens get a top-to-bottom one.
const TALL = window.innerWidth < 760 && window.innerHeight > window.innerWidth;
const BODIES = TALL
  ? {
      earth: { pos: [2.5, 0.6, -2], r: 2.5, spin: 0.05 },
      moon: { pos: [-3.2, 2.0, 0], r: 1.1, spin: 0.03 },
      mars: { pos: [-0.6, -5.7, 0], r: 3.1, spin: 0.035 },
    }
  : {
      earth: { pos: [-15, -1.5, -4], r: 2.6, spin: 0.05 },
      moon: { pos: [-7.5, 2.6, 1], r: 1.15, spin: 0.03 },
      mars: { pos: [6.5, -0.6, 0], r: 3.4, spin: 0.035 },
    };
const VOYAGER_POS = TALL ? new THREE.Vector3(4.6, -3.2, -3) : new THREE.Vector3(30, 13, -38);

// ---------- Procedural textures (used when no real map is in /public/textures) ----------
// Compact 3D value noise with smooth interpolation: good enough for planet surfaces.
function makeNoise(seed) {
  const p = new Uint8Array(512);
  const perm = [...Array(256).keys()];
  let s = seed;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  const h = (x, y, z) => p[p[p[x & 255] + (y & 255)] + (z & 255)] / 255;
  const noise = (x, y, z) => {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    const Z = Math.floor(z);
    const u = fade(x - X);
    const v = fade(y - Y);
    const w = fade(z - Z);
    return lerp(
      lerp(lerp(h(X, Y, Z), h(X + 1, Y, Z), u), lerp(h(X, Y + 1, Z), h(X + 1, Y + 1, Z), u), v),
      lerp(lerp(h(X, Y, Z + 1), h(X + 1, Y, Z + 1), u), lerp(h(X, Y + 1, Z + 1), h(X + 1, Y + 1, Z + 1), u), v),
      w,
    );
  };
  return (x, y, z, oct = 5) => {
    let a = 0.5;
    let f = 1;
    let sum = 0;
    for (let i = 0; i < oct; i++) {
      sum += a * noise(x * f, y * f, z * f);
      a *= 0.5;
      f *= 2.03;
    }
    return sum / 0.97;
  };
}

function paintPlanet(kind, w = 1024, h = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(w, h);
  const n = makeNoise(kind === "mars" ? 7 : kind === "moon" ? 3 : 11);
  const n2 = makeNoise(kind === "mars" ? 21 : 5);
  for (let y = 0; y < h; y++) {
    const lat = (0.5 - y / h) * Math.PI;
    for (let x = 0; x < w; x++) {
      const lon = (x / w) * Math.PI * 2 - Math.PI;
      const cx = -Math.cos(lon + Math.PI) * Math.cos(lat);
      const cy = Math.sin(lat);
      const cz = Math.sin(lon + Math.PI) * Math.cos(lat);
      let r;
      let g;
      let b;
      if (kind === "mars") {
        const base = n(cx * 2.2 + 5, cy * 2.2, cz * 2.2, 6);
        const dark = n2(cx * 1.4, cy * 1.4 + 3, cz * 1.4, 4);
        const d = Math.max(0, Math.min(1, (dark - 0.47) * 4));
        const t = base;
        r = 190 + 45 * t - 95 * d;
        g = 92 + 30 * t - 50 * d;
        b = 52 + 18 * t - 25 * d;
        const pole = Math.max(0, (Math.abs(cy) - 0.9) * 14 + (base - 0.5) * 2);
        const k = Math.min(1, pole);
        r = r * (1 - k) + 236 * k;
        g = g * (1 - k) + 228 * k;
        b = b * (1 - k) + 220 * k;
      } else if (kind === "moon") {
        const base = n(cx * 3 + 1, cy * 3, cz * 3, 6);
        const mare = n2(cx * 1.2, cy * 1.2, cz * 1.2 + 7, 4);
        const m = Math.max(0, Math.min(1, (mare - 0.5) * 5));
        const v = 150 + 70 * base - 70 * m;
        r = v;
        g = v * 0.985;
        b = v * 0.96;
      } else {
        const land = n(cx * 1.8, cy * 1.8 + 2, cz * 1.8, 6);
        const cloud = n2(cx * 3, cy * 6, cz * 3, 5);
        const isLand = land > 0.53;
        if (isLand) {
          const t = (land - 0.53) * 4;
          r = 60 + 90 * t;
          g = 95 + 50 * t;
          b = 50 + 20 * t;
        } else {
          r = 14;
          g = 48 + 30 * land;
          b = 110 + 60 * land;
        }
        const c = Math.max(0, Math.min(1, (cloud - 0.52) * 3.2));
        r = r * (1 - c) + 240 * c;
        g = g * (1 - c) + 244 * c;
        b = b * (1 - c) + 250 * c;
        const ice = Math.max(0, Math.min(1, (Math.abs(cy) - 0.86) * 12));
        r = r * (1 - ice) + 235 * ice;
        g = g * (1 - ice) + 240 * ice;
        b = b * (1 - ice) + 245 * ice;
      }
      const i = (y * w + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Use a real planet map from /public/textures if it's there; otherwise paint one.
function loadOrPaint(kind, onReady) {
  new THREE.TextureLoader().load(
    `/textures/${kind}.jpg`,
    (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      onReady(t, true);
    },
    undefined,
    () => onReady(paintPlanet(kind, kind === "mars" ? 1024 : 768, kind === "mars" ? 512 : 384), false),
  );
}

// Point on a sphere for a latitude/longitude, matching Three.js sphere UVs.
function latLonToVec(lat, lon, r) {
  const phi = THREE.MathUtils.degToRad(lon + 180);
  const theta = THREE.MathUtils.degToRad(lat);
  return new THREE.Vector3(-Math.cos(phi) * Math.cos(theta) * r, Math.sin(theta) * r, Math.sin(phi) * Math.cos(theta) * r);
}

function atmosphere(r, color, power = 3.2, strength = 1) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { c: { value: new THREE.Color(color) }, p: { value: power }, s: { value: strength } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 c; uniform float p; uniform float s; varying vec3 vN; varying vec3 vV; void main(){ float f = 1.0 - max(dot(vN, vV), 0.0); float i = pow(f, p) * s; gl_FragColor = vec4(c * i, 1.0); }`,
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(r * 1.025, 96, 64), mat);
}

function glowTexture(inner = "rgba(255,255,255,1)", outer = "rgba(255,255,255,0)") {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.25, inner.replace(/[\d.]+\)$/, "0.5)"));
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function ringTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  g.strokeStyle = "rgba(255,255,255,0.95)";
  g.lineWidth = 6;
  g.beginPath();
  g.arc(64, 64, 56, 0, Math.PI * 2);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createScene({ canvas, labelsEl, machines, onPick }) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = window.innerWidth < 760;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setClearColor("#03040a", 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.75 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.05, 2000);

  // Light: the Sun is far off to the left.
  const sunDir = new THREE.Vector3(-1, 0.25, 0.55).normalize();
  const sunLight = new THREE.DirectionalLight("#fff1dc", 4.2);
  sunLight.position.copy(sunDir.clone().multiplyScalar(100));
  scene.add(sunLight);
  // Daylight sky: the shadow side picks up warm light instead of going black.
  const ambient = new THREE.AmbientLight("#1a2140", 0.28);
  scene.add(ambient);
  // A cool rim light from behind gives every planet a glossy, studio-lit edge.
  const rim = new THREE.DirectionalLight("#7f9fff", 0.9);
  rim.position.set(60, 25, -70);
  scene.add(rim);

  // Stars: thousands of points in a big shell, gently twinkling
  {
    const N = TALL ? 4000 : 9000;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const size = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(260 + Math.random() * 500);
      pos.set([v.x, v.y, v.z], i * 3);
      const c = new THREE.Color().setHSL(0.6 + (Math.random() - 0.5) * 0.2, 0.35 * Math.random(), 0.72 + 0.28 * Math.random());
      col.set([c.r, c.g, c.b], i * 3);
      size[i] = Math.random() < 0.03 ? 3 : 0.5 + Math.random() * 1.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(size, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, pr: { value: renderer.getPixelRatio() } },
      vertexShader: `attribute float size; attribute vec3 color; varying vec3 vC; varying float vT; uniform float time; uniform float pr;
        void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0);
        vT = 0.6 + 0.4 * sin(time * 1.2 + position.x * 0.11 + position.y * 0.07);
        gl_PointSize = size * pr * (380.0 / -mv.z) * 0.33; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; varying float vT; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vC * vT * a, a); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const stars = new THREE.Points(geo, mat);
    scene.add(stars);
    scene.userData.starMat = mat;
    scene.userData.stars = stars;
  }

  // A distant sun glow off to the side
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("rgba(255,226,190,1)"), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }));
  sunGlow.position.copy(sunDir.clone().multiplyScalar(220));
  sunGlow.scale.setScalar(60);
  scene.add(sunGlow);

  // Planets
  const bodies = {};
  for (const [key, b] of Object.entries(BODIES)) {
    const group = new THREE.Group();
    group.position.set(...b.pos);
    scene.add(group);
    const spinner = new THREE.Group();
    spinner.rotation.z = key === "mars" ? 0.44 : key === "earth" ? 0.41 : 0.03; // axial tilt
    group.add(spinner);
    // Earth gets a glossy ocean (specular map); Mars and the Moon stay matte rock.
    const mat =
      key === "earth"
        ? new THREE.MeshPhongMaterial({ color: "#ffffff", specular: new THREE.Color("#9fb8d8"), shininess: 28 })
        : new THREE.MeshPhysicalMaterial({
            roughness: key === "mars" ? 0.85 : 0.95,
            metalness: 0,
            color: "#ffffff",
            clearcoat: 0.12,
            clearcoatRoughness: 0.6,
            sheen: 0.15,
            sheenColor: new THREE.Color(key === "mars" ? "#ffb08a" : "#dfe6ff"),
          });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(b.r, 160, 120), mat);
    spinner.add(mesh);
    const loader = new THREE.TextureLoader();
    const extra = (file, fn) =>
      loader.load(`/textures/${file}`, (t) => {
        fn(t);
        mat.needsUpdate = true;
      });
    loadOrPaint(key, (tex, real) => {
      mat.map = tex;
      if (key === "mars") {
        mat.bumpMap = tex;
        mat.bumpScale = 0.5;
      }
      if (!real) {
        mat.bumpMap = tex;
        mat.bumpScale = 1.5;
      }
      mat.needsUpdate = true;
      if (real && key === "earth") {
        extra("earth-water.jpg", (t) => (mat.specularMap = t));
        extra("earth-bump.jpg", (t) => {
          mat.bumpMap = t;
          mat.bumpScale = 3;
        });
      }
      if (real && key === "moon") extra("moon-bump.jpg", (t) => ((mat.bumpMap = t), (mat.bumpScale = 4)));
    });
    if (key === "earth") {
      // A separate, slowly drifting cloud layer
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(b.r * 1.012, 96, 72),
        new THREE.MeshLambertMaterial({ color: "#ffffff", transparent: true, opacity: 0.9, depthWrite: false }),
      );
      loader.load("/textures/clouds.jpg", (t) => {
        clouds.material.alphaMap = t;
        clouds.material.needsUpdate = true;
      }, undefined, () => (clouds.visible = false));
      spinner.add(clouds);
      b.clouds = clouds;
    }
    // Soft coloured halo behind each planet
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture({ mars: "rgba(255,120,80,1)", earth: "rgba(90,170,255,1)", moon: "rgba(190,200,255,1)" }[key]),
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    halo.scale.setScalar(b.r * 3.6);
    // sits at the centre: the planet hides the middle, so only a glow around the edge shows
    group.add(halo);

    // Grow in when the page opens
    group.scale.setScalar(reduceMotion ? 1 : 0.001);
    b.grow = { delay: { moon: 0.25, earth: 0.1, mars: 0.4 }[key], done: reduceMotion };
    if (key === "mars") {
      const atm = atmosphere(b.r, "#ff8a5a", 4.2, 0.8);
      group.add(atm);
      b.atm = atm;
    }
    if (key === "earth") group.add(atmosphere(b.r, "#5ea8ff", 2.2, 1.6));
    if (key === "moon") group.add(atmosphere(b.r, "#c9d4ff", 4.5, 0.35));
    bodies[key] = { ...b, group, spinner, mesh };
  }
  // Start each planet turned so its machines face the camera in the overview.
  bodies.mars.spinner.rotation.y = -1.4;
  bodies.moon.spinner.rotation.y = -0.9;

  // Voyager 1, modelled after the real spacecraft: a 3.7 m white dish, a ten-sided
  // bus wrapped in gold foil, the Golden Record, three RTG power units on one boom,
  // the science platform on another, and the long magnetometer boom.
  const voyager = new THREE.Group();
  voyager.position.copy(VOYAGER_POS);
  const craft = new THREE.Group();
  voyager.add(craft);
  const vwaves = [];
  {
    const dishMat = new THREE.MeshPhysicalMaterial({ color: "#bdb9b0", roughness: 0.5, metalness: 0.1, clearcoat: 0.35, clearcoatRoughness: 0.3, side: THREE.DoubleSide });
    const foil = new THREE.MeshPhysicalMaterial({ color: "#d9a43a", metalness: 0.95, roughness: 0.28, clearcoat: 0.4 });
    const dark = new THREE.MeshStandardMaterial({ color: "#2a2b30", metalness: 0.6, roughness: 0.45 });
    const steel = new THREE.MeshStandardMaterial({ color: "#c9cbd1", metalness: 0.85, roughness: 0.3 });
    const gold = new THREE.MeshPhysicalMaterial({ color: "#f3c35b", metalness: 1, roughness: 0.18, clearcoat: 1 });
    const S = 0.55; // overall scale

    // Parabolic high-gain antenna (front faces +Z, toward Earth after lookAt)
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const r = (i / 24) * 1.85;
      pts.push(new THREE.Vector2(r, (r * r) / (4 * 1.6)));
    }
    const dish = new THREE.Mesh(new THREE.LatheGeometry(pts, 72), dishMat);
    dish.rotation.x = Math.PI / 2;
    dish.position.z = 0.15;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.03, 8, 72), steel);
    rim.position.z = 0.15 + (1.85 * 1.85) / 6.4;
    // Feed: sub-reflector held by three struts
    const sub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.12, 0.08, 24), steel);
    sub.rotation.x = Math.PI / 2;
    sub.position.z = 1.55;
    const struts = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const from = new THREE.Vector3(Math.cos(a) * 1.5, Math.sin(a) * 1.5, 0.15 + (1.5 * 1.5) / 6.4);
      const to = new THREE.Vector3(0, 0, 1.55);
      const len = from.distanceTo(to);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, len, 6), steel);
      st.position.copy(from.clone().add(to).multiplyScalar(0.5));
      st.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
      struts.add(st);
    }

    // Ten-sided bus behind the dish, wrapped in gold foil
    const bus = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.5, 10), foil);
    bus.rotation.x = Math.PI / 2;
    bus.position.z = -0.2;
    const busTop = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.86, 0.04, 10), dark);
    busTop.rotation.x = Math.PI / 2;
    busTop.position.z = -0.47;
    // The Golden Record on one face of the bus
    const record = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 40), gold);
    record.position.set(0.83, 0, -0.2);
    record.rotation.z = Math.PI / 2;

    // Booms
    const boom = (len, r, mat) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
    // RTG boom with three finned power units
    const rtgArm = new THREE.Group();
    const rb = boom(2.4, 0.025, steel);
    rb.position.y = 1.2;
    rtgArm.add(rb);
    for (let k = 0; k < 3; k++) {
      const u = new THREE.Group();
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.42, 16), dark);
      u.add(core);
      for (let f = 0; f < 6; f++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.4, 0.18), dark);
        const a = (f / 6) * Math.PI * 2;
        fin.position.set(Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17);
        fin.rotation.y = -a;
        u.add(fin);
      }
      u.position.y = 1.0 + k * 0.48;
      rtgArm.add(u);
    }
    rtgArm.rotation.z = Math.PI / 2 + 0.35;
    rtgArm.position.set(-0.5, -0.1, -0.25);

    // Science boom with the scan platform (cameras)
    const sciArm = new THREE.Group();
    const sb = boom(2.2, 0.03, steel);
    sb.position.y = 1.1;
    const platform = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.3), dark);
    platform.position.y = 2.25;
    const cam1 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.38, 16), steel);
    cam1.rotation.x = Math.PI / 2;
    cam1.position.set(0.1, 2.3, 0.3);
    const cam2 = cam1.clone();
    cam2.position.x = -0.1;
    sciArm.add(sb, platform, cam1, cam2);
    sciArm.rotation.z = -Math.PI / 2 - 0.3;
    sciArm.position.set(0.5, 0.1, -0.25);

    // Long thin magnetometer boom
    const mag = boom(6.5, 0.008, steel);
    mag.rotation.z = Math.PI / 2 - 0.9;
    mag.position.set(-1.6, -2.2, -0.3);

    // Small blinking navigation light
    const blink = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("rgba(255,120,90,1)"), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    blink.scale.setScalar(0.35);
    blink.position.set(0, 0.95, -0.2);
    craft.userData.blink = blink;

    craft.add(dish, rim, sub, struts, bus, busTop, record, rtgArm, sciArm, mag, blink);
    craft.scale.setScalar(S);
    voyager.lookAt(new THREE.Vector3(...BODIES.earth.pos)); // the dish points home

    // Radio waves leaving the dish toward Earth
    for (let k = 0; k < 4; k++) {
      const w = new THREE.Mesh(
        new THREE.RingGeometry(0.93, 1, 96),
        new THREE.MeshBasicMaterial({ color: "#9fc2ff", transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      w.userData.phase = k / 4;
      voyager.add(w);
      vwaves.push(w);
    }
  }
  scene.add(voyager);
  {
    const e = new THREE.Vector3(...BODIES.earth.pos);
    const curve = new THREE.CatmullRomCurve3([
      e,
      e.clone().lerp(VOYAGER_POS, 0.35).add(new THREE.Vector3(TALL ? 2 : -3, TALL ? 1 : 5, -4)),
      e.clone().lerp(VOYAGER_POS, 0.7).add(new THREE.Vector3(TALL ? 1.5 : 0, TALL ? 1 : 3, -3)),
      VOYAGER_POS.clone(),
      VOYAGER_POS.clone().add(new THREE.Vector3(14, 5, -14)),
    ]);
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(240));
    const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: "#c9d2ff", dashSize: 0.3, gapSize: 0.45, transparent: true, opacity: 0.35 }));
    line.computeLineDistances();
    scene.add(line);
    scene.userData.trail = line;
  }

  // Machine pins: glowing dot + pulsing ring on the surface, plus an HTML label.
  const dotTex = glowTexture();
  const ringTex = ringTexture();
  const pins = {};
  for (const m of machines) {
    const site = SITES[m.id];
    const holder = new THREE.Group();
    let normal;
    if (site) {
      const b = bodies[site.body];
      const p = latLonToVec(site.lat, site.lon, b.r * 1.004);
      holder.position.copy(p);
      normal = p.clone().normalize();
      b.mesh.add(holder);
    } else {
      holder.position.set(0, 1.6, 0);
      voyager.add(holder);
      normal = null;
    }
    const color = new THREE.Color(m.status === "duty" ? "#7ee2a8" : "#ffb547");
    const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true }));
    dot.visible = false;
    holder.add(dot);
    const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.visible = false;
    holder.add(ring);

    const el = document.createElement("button");
    el.type = "button";
    el.className = `pin ${m.status === "duty" ? "duty" : ""}`;
    el.innerHTML = `<i></i><span>${m.name}</span>`;
    el.setAttribute("aria-label", `Talk to ${m.name}`);
    el.addEventListener("click", () => onPick(m));
    labelsEl.appendChild(el);
    pins[m.id] = { m, holder, normal, dot, ring, el, phase: Math.random() * 6, body: site?.body ?? "deep" };
  }

  // Planet name labels
  const bodyLabels = {};
  for (const [key, name] of [["earth", "Earth"], ["moon", "The Moon"], ["mars", "Mars"]]) {
    const el = document.createElement("span");
    el.className = "body-name";
    el.textContent = name;
    labelsEl.appendChild(el);
    bodyLabels[key] = el;
  }

  // Bloom: lets the lit edges and atmospheres glow like a film camera
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), TALL ? 0.4 : 0.5, 0.5, 0.8));
  composer.addPass(new OutputPass());

  // Camera control: drag to spin around whatever you're looking at.
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.enableZoom = false; // the page scrolls; don't steal the mouse wheel
  const allowDrag = !TALL;
  if (!allowDrag) controls.enableRotate = false;
  controls.rotateSpeed = 0.5;
  controls.zoomSpeed = 0.6;

  const overviewCam = TALL
    ? { pos: new THREE.Vector3(0, 0.4, 35), target: new THREE.Vector3(0, 0.4, 0) }
    : { pos: new THREE.Vector3(-1, 3.5, 31), target: new THREE.Vector3(-3, 0.8, -2) };
  canvas.style.touchAction = "pan-y";
  camera.position.copy(overviewCam.pos);
  controls.target.copy(overviewCam.target);
  controls.minDistance = 4;
  controls.maxDistance = 70;

  let mode = "overview";
  let active = null;
  let tween = null;
  // How far the picture is shifted to make room for the chat panel (0 = centred).
  const shift = { x: 0, y: 0, tx: 0, ty: 0 };

  function applyShift() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (Math.abs(shift.x) < 0.001 && Math.abs(shift.y) < 0.001) camera.clearViewOffset();
    else camera.setViewOffset(w, h, shift.x * w, shift.y * h, w, h);
  }

  function flyTo(pos, target, dur = 1800) {
    if (reduceMotion) dur = 0;
    tween = { from: camera.position.clone(), fromT: controls.target.clone(), to: pos, toT: target, t0: performance.now(), dur };
  }

  // side: "panel" = chat card on the right, "text" = story text on the left.
  function focusMachine(m, panelOpen = true, side = panelOpen ? "panel" : "center") {
    active = m.id;
    mode = "focus";
    for (const p of Object.values(pins)) p.el.classList.toggle("active", p.m.id === m.id);
    const pin = pins[m.id];
    const mobile = window.innerWidth < 760;
    shift.tx = mobile ? 0 : side === "panel" ? 0.27 : side === "text" ? -0.22 : side === "dust" ? -0.3 : side === "finale" ? -0.3 : 0;
    shift.ty = mobile && side !== "center" ? (side === "panel" ? 0.3 : 0.3) : 0;
    const far = side === "text" ? (mobile ? 1.55 : 1.22) : side === "dust" ? (mobile ? 1.6 : 1.1) : side === "finale" ? 1.5 : 1;
    if (pin.body === "deep") {
      // Look at Voyager with Earth and the Sun far behind it: "looking back home".
      const target = VOYAGER_POS.clone();
      // Stand just beyond Voyager and look back toward the Sun and the planets.
      const toEarth = new THREE.Vector3(...BODIES.earth.pos).sub(target).normalize();
      const side = new THREE.Vector3().crossVectors(toEarth, new THREE.Vector3(0, 1, 0)).normalize();
      const dir = side.multiplyScalar(0.85).add(toEarth.clone().multiplyScalar(0.45)).add(new THREE.Vector3(0, 0.3, 0)).normalize();
      flyTo(target.clone().add(dir.multiplyScalar((mobile ? 6.5 : 4.6) * far)), target);
      controls.minDistance = 2.5;
      return;
    }
    const b = bodies[pin.body];
    b.group.updateMatrixWorld(true);
    const center = b.group.position.clone();
    const world = pin.holder.getWorldPosition(new THREE.Vector3());
    const out = world.clone().sub(center).normalize();
    // Turn the planet so the site sits in daylight, facing a point between the Sun and us.
    // rotation.y spins around the parent group's up axis (the tilt is applied first).
    const axis = new THREE.Vector3(0, 1, 0);
    const want = sunDir.clone().add(overviewCam.pos.clone().sub(center).normalize()).normalize();
    const flat = (v) => v.clone().sub(axis.clone().multiplyScalar(v.dot(axis))).normalize();
    const a = flat(out);
    const c = flat(want);
    let delta = Math.atan2(axis.dot(new THREE.Vector3().crossVectors(a, c)), a.dot(c));
    b.spinTarget = b.spinner.rotation.y + delta;
    b.spinFrom = b.spinner.rotation.y;
    b.spinT0 = performance.now();
    const viewDir = out.clone().applyAxisAngle(axis, delta).normalize();
    const dist = b.r * (pin.body === "moon" ? (mobile ? 4.6 : 3.4) : mobile ? 3.9 : 2.9) * far;
    flyTo(center.clone().add(viewDir.multiplyScalar(dist)), center.clone());
    controls.minDistance = b.r * 1.5;
  }

  // Opening shot: a big, slowly turning Mars beside the title.
  function heroView() {
    active = null;
    mode = "hero";
    for (const p of Object.values(pins)) p.el.classList.remove("active");
    for (const b of Object.values(bodies)) b.spinTarget = null;
    const mobile = window.innerWidth < 760;
    shift.tx = mobile ? 0 : -0.3;
    shift.ty = mobile ? 0.34 : 0;
    const b = bodies.mars;
    const c = b.group.position.clone();
    // Side-lit: the Sun is to the left, so the right edge falls into night
    const dir = new THREE.Vector3(0.62, 0.12, 0.78).normalize();
    flyTo(c.clone().add(dir.multiplyScalar(b.r * (mobile ? 6.6 : 4.2))), c, 2000);
  }

  // Open sky with nothing in front of it, for text-only sections
  function skyView() {
    active = null;
    mode = "sky";
    for (const p of Object.values(pins)) p.el.classList.remove("active");
    shift.tx = 0;
    shift.ty = 0;
    const from = new THREE.Vector3(0, 6, 40);
    flyTo(from, from.clone().add(new THREE.Vector3(0.15, 0.55, -1).normalize().multiplyScalar(30)), 2000);
  }

  function overview() {
    active = null;
    for (const b of Object.values(bodies)) b.spinTarget = null;
    mode = "overview";
    for (const p of Object.values(pins)) p.el.classList.remove("active");
    shift.tx = 0;
    shift.ty = 0;
    controls.minDistance = 4;
    flyTo(overviewCam.pos.clone(), overviewCam.target.clone(), 2000);
  }

  // Gentle parallax on the overview.
  const mouse = new THREE.Vector2();
  window.addEventListener("pointermove", (e) => {
    mouse.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  });

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    applyShift();
  }
  window.addEventListener("resize", resize);

  const tmp = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  const clock = new THREE.Clock();

  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    for (const [key, b] of Object.entries(bodies)) {
      if (!b.grow.done) {
        const k = Math.min(1, Math.max(0, (t - b.grow.delay) / 1.6));
        const e = 1 - Math.pow(1 - k, 4);
        b.group.scale.setScalar(Math.max(0.001, e));
        if (k >= 1) b.grow.done = true;
      }
      if (b.clouds) b.clouds.rotation.y += 0.012 * dt;
      if (key === "earth") {
        craft.rotation.z = Math.sin(t * 0.25) * 0.08;
        craft.userData.blink.material.opacity = Math.sin(t * 3) > 0.6 ? 1 : 0.15;
        for (const w of vwaves) {
          const ph = (t * 0.35 + w.userData.phase) % 1;
          w.position.z = 1.1 + ph * 6;
          w.scale.setScalar(0.6 + ph * 1.6);
          w.material.opacity = Math.sin(ph * Math.PI) * 0.55;
        }
      }
      scene.userData.starMat.uniforms.time.value = t;
      scene.userData.stars.rotation.y = t * 0.004;
      if (b.spinTarget != null) {
        // Turn the planet on the same clock as the camera flight, so the site lands in view on time
        const k = reduceMotion ? 1 : Math.min(1, (performance.now() - b.spinT0) / 1700);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        b.spinner.rotation.y = b.spinFrom + (b.spinTarget - b.spinFrom) * e;
        if (k >= 1) b.spinTarget = null;
      } else if (!reduceMotion && (mode !== "focus" || key === "earth")) {
        b.spinner.rotation.y += b.spin * dt;
      }
    }
    scene.userData.trail.material.dashOffset = -t * 0.6;

    if (tween) {
      const k = tween.dur ? Math.min(1, (performance.now() - tween.t0) / tween.dur) : 1;
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      camera.position.lerpVectors(tween.from, tween.to, e);
      controls.target.lerpVectors(tween.fromT, tween.toT, e);
      if (k >= 1) tween = null;
    } else if (mode !== "focus" && !reduceMotion) {
      // drift slightly with the mouse
      if (mode === "overview") {
        const want = overviewCam.pos.clone().add(new THREE.Vector3(mouse.x * 1.6, -mouse.y * 0.9, 0));
        camera.position.lerp(want, 0.02);
      }
    }
    controls.enabled = !tween;
    controls.update();

    shift.x += (shift.tx - shift.x) * 0.06;
    shift.y += (shift.ty - shift.y) * 0.06;
    applyShift();

    // Pins: pulse, and place the HTML labels; hide ones on the far side of a planet.
    camera.getWorldDirection(camDir);
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const p of Object.values(pins)) {
      const world = p.holder.getWorldPosition(tmp);
      let facing = 1;
      // Voyager is far away; only label it when it's the subject or in the wide view
      if (!p.normal && (mode === "hero" || mode === "sky" || (mode === "focus" && active !== p.m.id))) facing = -1;
      if (p.normal) {
        const n = p.normal.clone().applyQuaternion(p.holder.parent.getWorldQuaternion(new THREE.Quaternion()));
        const toCam = camera.position.clone().sub(world).normalize();
        facing = n.dot(toCam);
        if (!bodies[p.body].group.visible || mode === "sky") facing = -1;
      }
      const ph = (t * 0.8 + p.phase) % 1;
      const isActive = p.m.id === active;
      const base = p.body === "deep" ? 0.001 : camera.position.distanceTo(world) * 0.016;
      p.ring.scale.setScalar(p.body === "deep" ? 0.001 : base * (1 + ph * (isActive ? 4 : 2.6)));
      p.ring.material.opacity = (1 - ph) * 0.8;
      p.dot.scale.setScalar(p.body === "deep" ? 0.001 : base * (isActive ? 1.5 : 1));

      const v = world.clone().project(camera);
      const visible = v.z < 1 && facing > 0.08;
      const x = (v.x * 0.5 + 0.5) * w;
      const y = (-v.y * 0.5 + 0.5) * h;
      p.el.style.transform = `translate(${x}px, ${y}px)`;
      p.el.classList.toggle("hidden", !visible);
      p.el.tabIndex = visible ? 0 : -1;
      p.el.style.opacity = visible ? Math.min(1, (facing - 0.08) * 5) : 0;
    }

    // In the opening shot only Mars is on stage
    for (const [key, b] of Object.entries(bodies)) {
      const show = mode !== "hero" || key === "mars";
      b.group.visible = show;
    }
    voyager.visible = mode !== "hero";
    scene.userData.trail.visible = mode !== "hero";
    for (const [key, el] of Object.entries(bodyLabels)) {
      const b = bodies[key];
      const v = b.group.position.clone().add(new THREE.Vector3(0, -b.r * 1.18, 0)).project(camera);
      el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%, 0)`;
      el.style.opacity = mode === "overview" && !tween ? 1 : 0;
    }
    document.body.dataset.view = mode;

    scene.userData.applyDust?.();
    composer.render();
    requestAnimationFrame(tick);
  }

  resize();
  tick();

  // Dust storm: dim the Sun, thicken and brown the Martian air (t from 0 to 1)
  const dustTarget = { t: 0 };
  const dustNow = { t: 0 };
  function setDust(t) {
    dustTarget.t = t;
  }
  function applyDust() {
    dustNow.t += (dustTarget.t - dustNow.t) * 0.08;
    const t = dustNow.t;
    sunLight.intensity = 4.2 * Math.pow(1 - t, 1.6) + 0.12;
    sunLight.color.set("#fff1dc").lerp(new THREE.Color("#c46a2c"), t);
    ambient.color.set("#1a2140").lerp(new THREE.Color("#3a1a0c"), t);
    const atm = bodies.mars.atm;
    if (atm) {
      atm.material.uniforms.s.value = 0.8 + t * 2.2;
      atm.material.uniforms.p.value = 4.2 - t * 2.6;
      atm.material.uniforms.c.value.set("#ff8a5a").lerp(new THREE.Color("#b8642e"), t);
    }
  }
  scene.userData.applyDust = applyDust;

  return { focusMachine, overview, heroView, skyView, setDust, canvas };
}
