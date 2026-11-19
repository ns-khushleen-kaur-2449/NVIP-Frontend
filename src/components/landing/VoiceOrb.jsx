import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { supportsWebGL } from './webgl';

/*
 * The hero's 3D voice agent (plain three.js), after the approved mockup:
 *
 *   orb         a dark glass sphere with an orange voice waveform glowing inside it
 *   headphones  a metal headband and ear cups with orange accents, worn by the orb
 *   ring        one tilted orange orbit with a light travelling along it
 *   stand       a dark two-tier pedestal with a glowing orange rim and light rising to the orb
 *   waves       faint sound-wave bars either side
 *
 * The waveform follows a speech-like level; pointer over the scene makes the agent "talk" and turns it toward the
 * pointer. The loop stops off-screen and in hidden tabs; with reduced motion it renders one still frame.
 * Lazy-loaded by LandingHero, which draws the same scene as a static SVG (OrbFallback) while this loads or
 * where WebGL is missing. World units: the orb has radius 1; LandingHero's fallback uses the same coordinates.
 */

const ORB_Y = 0.3;
const STAND_Y = -1.28;
const BARS = 15;
const SIDE_BARS = 8;

const PLANE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** Rounded bars with a soft glow, drawn in one plane. Heights come from uBars (0..1 of the plane height). */
const barsFrag = (count) => /* glsl */ `
  #define NB ${count}
  uniform float uBars[NB];
  uniform vec2 uSize;
  uniform float uBarW;
  uniform vec3 uColor;
  uniform vec3 uHot;
  uniform float uAlpha;
  uniform float uFade;
  varying vec2 vUv;
  float sdRoundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  void main() {
    vec2 p = (vUv - 0.5) * uSize;
    float pitch = uSize.x / float(NB);
    float core = 0.0;
    float glow = 0.0;
    for (int k = 0; k < NB; k++) {
      float cx = -0.5 * uSize.x + (float(k) + 0.5) * pitch;
      float halfH = max(uBarW, uBars[k] * 0.5 * uSize.y);
      float d = sdRoundBox(p - vec2(cx, 0.0), vec2(uBarW, halfH), uBarW);
      core = max(core, 1.0 - smoothstep(-0.004, 0.004, d));
      glow += exp(-max(d, 0.0) * 30.0) * 0.16;
    }
    float fade = mix(1.0, 1.0 - vUv.x, uFade);
    vec3 col = mix(uColor, uHot, core * 0.22);
    float a = clamp(core + glow, 0.0, 1.0) * uAlpha * fade;
    gl_FragColor = vec4(col, a);
  }
`;

const SHELL_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }
`;

/** Smoked glass: clear enough at the centre to see the waveform, near-black toward the edge. */
const SHELL_DARK_FRAG = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float facing = max(dot(normalize(vNormal), normalize(vView)), 0.0);
    float alpha = mix(0.2, 0.97, pow(1.0 - facing, 1.35));
    gl_FragColor = vec4(0.045, 0.032, 0.03, alpha);
  }
`;

/** Light on the glass: an orange rim (strongest low and right, toward the stand's glow) and a white key highlight. */
const SHELL_LIGHT_FRAG = /* glsl */ `
  uniform vec3 uRim;
  uniform float uLevel;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec3 n = normalize(vNormal);
    float facing = max(dot(n, normalize(vView)), 0.0);
    float rim = pow(1.0 - facing, 2.6);
    float warm = smoothstep(-0.3, 0.8, dot(n, normalize(vec3(0.5, -0.8, 0.25))));
    vec3 col = uRim * rim * (0.25 + 1.25 * warm) * (0.85 + 0.35 * uLevel);
    float s = max(dot(n, normalize(vec3(-0.5, 0.6, 0.62))), 0.0);
    col += vec3(1.0) * (pow(s, 80.0) * 0.9 + pow(s, 10.0) * 0.06);
    float band = smoothstep(0.55, 0.6, n.y) * (1.0 - smoothstep(0.66, 0.74, n.y)) * smoothstep(0.1, 0.6, facing);
    col += vec3(1.0) * band * 0.06;
    gl_FragColor = vec4(col, 1.0);
  }
`;

/** Light rising from the stand to the orb: fades upward. */
const BEAM_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uLevel;
  varying vec2 vUv;
  void main() {
    float a = pow(1.0 - vUv.y, 1.6) * 0.24 * (0.75 + 0.45 * uLevel);
    gl_FragColor = vec4(uColor, a);
  }
`;

function radialTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([at, color]) => grad.addColorStop(at, color));
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const ORANGE = new THREE.Vector3(1.0, 0.478, 0.184);
const ORANGE_HOT = new THREE.Vector3(1.0, 0.86, 0.72);

function barsMaterial(count, { size, barW, alpha, fade, blending }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBars: { value: new Array(count).fill(0.2) },
      uSize: { value: new THREE.Vector2(size[0], size[1]) },
      uBarW: { value: barW },
      uColor: { value: ORANGE.clone() },
      uHot: { value: ORANGE_HOT.clone() },
      uAlpha: { value: alpha },
      uFade: { value: fade },
    },
    vertexShader: PLANE_VERT,
    fragmentShader: barsFrag(count),
    transparent: true,
    depthWrite: false,
    blending,
    side: THREE.DoubleSide,
  });
}

export default function VoiceOrb({ className, onUnsupported }) {
  const mountRef = useRef(null);
  // Read through a ref so a new callback identity never tears down and rebuilds the scene.
  const unsupportedRef = useRef(onUnsupported);
  unsupportedRef.current = onUnsupported;

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return undefined;
    const onUnsupported = () => unsupportedRef.current?.();
    if (!supportsWebGL()) {
      onUnsupported();
      return undefined;
    }

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      onUnsupported();
      return undefined;
    }
    const width = () => el.clientWidth || 560;
    const height = () => el.clientHeight || 510;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(width(), height(), false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.setAttribute('aria-hidden', 'true');
    el.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, width() / height(), 0.1, 100);
    // Fit the whole scene (orb, headphones, side waves, stand) at any aspect ratio.
    const frame = () => {
      const aspect = width() / height();
      const fit = 0.5359; // 2 * tan(15deg): visible height per unit of distance at fov 30
      const d = Math.max(3.75 / fit, 4.85 / (fit * aspect));
      camera.aspect = aspect;
      camera.position.set(0, 0.42, d);
      camera.lookAt(0, -0.02, 0);
      camera.updateProjectionMatrix();
    };
    frame();

    // Image-based light for the metal, so the headphones and the stand read as real materials.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const envMap = pmrem.fromScene(room, 0.04).texture;
    scene.environment = envMap;
    scene.environmentIntensity = 0.55;

    scene.add(new THREE.HemisphereLight('#FFF1E6', '#3A1A08', 0.8));
    const key = new THREE.DirectionalLight('#FFFFFF', 2.0);
    key.position.set(-3, 4, 5);
    scene.add(key);
    [
      { color: '#FF7A2F', intensity: 22, pos: [2.4, -1.0, 2.0] },
      { color: '#FF8A45', intensity: 12, pos: [-2.6, -0.8, 1.6] },
      { color: '#FF7A2F', intensity: 6, pos: [0, -1.0, 0.9] },
    ].forEach(({ color, intensity, pos }) => {
      const light = new THREE.PointLight(color, intensity, 0, 2);
      light.position.set(...pos);
      scene.add(light);
    });

    const metal = new THREE.MeshStandardMaterial({ color: '#3A3D46', metalness: 0.85, roughness: 0.28 });
    const metalLight = new THREE.MeshStandardMaterial({ color: '#6B6F7A', metalness: 0.9, roughness: 0.22 });
    const cushion = new THREE.MeshStandardMaterial({ color: '#141418', metalness: 0, roughness: 0.85 });
    const accent = new THREE.MeshBasicMaterial({ color: '#FF7A2F' });
    const accentSoft = new THREE.MeshBasicMaterial({ color: '#FF8A45', transparent: true, opacity: 0.22, depthWrite: false });

    /* ---------- the orb, with its headphones and ring: turns toward the pointer ---------- */
    const head = new THREE.Group();
    head.position.y = ORB_Y;
    scene.add(head);

    const sphereGeo = new THREE.SphereGeometry(1, 96, 96);
    const back = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color: '#0C0909', side: THREE.BackSide }));
    head.add(back);

    const innerGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialTexture([[0, 'rgba(254, 119, 37, 0.5)'], [0.45, 'rgba(254, 100, 30, 0.2)'], [1, 'rgba(254, 119, 37, 0)']]),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    innerGlow.scale.set(1.55, 1.55, 1);
    innerGlow.renderOrder = 1;
    head.add(innerGlow);

    const bars = new THREE.Mesh(
      new THREE.PlaneGeometry(1.36, 0.92),
      barsMaterial(BARS, { size: [1.36, 0.92], barW: 0.022, alpha: 1, fade: 0, blending: THREE.AdditiveBlending }),
    );
    bars.position.z = 0.25;
    bars.renderOrder = 2;
    head.add(bars);

    const shellDark = new THREE.Mesh(sphereGeo, new THREE.ShaderMaterial({
      vertexShader: SHELL_VERT,
      fragmentShader: SHELL_DARK_FRAG,
      transparent: true,
      depthWrite: false,
    }));
    shellDark.renderOrder = 3;
    head.add(shellDark);

    const level = { value: 0.3 };
    const shellLight = new THREE.Mesh(sphereGeo, new THREE.ShaderMaterial({
      uniforms: { uRim: { value: new THREE.Vector3(1.0, 0.56, 0.26) }, uLevel: level },
      vertexShader: SHELL_VERT,
      fragmentShader: SHELL_LIGHT_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    shellLight.renderOrder = 4;
    head.add(shellLight);

    // Headphones: a half-torus band over the top, sliders, and an ear cup either side.
    const band = new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.075, 24, 120, Math.PI), metal);
    head.add(band);
    const pad = new THREE.Mesh(new THREE.TorusGeometry(1.085, 0.05, 18, 90, Math.PI * 0.6), cushion);
    pad.rotation.z = Math.PI * 0.2;
    head.add(pad);
    [-1, 1].forEach((side) => {
      const slider = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3, 0.13), metalLight);
      slider.position.set(side * 1.16, 0.34, 0);
      const cup = new THREE.Group();
      cup.position.set(side * 1.17, -0.02, 0);
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.37, 0.24, 48), metal);
      shell.rotation.z = Math.PI / 2;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.06, 48), metalLight);
      cap.rotation.z = Math.PI / 2;
      cap.position.x = side * 0.14;
      const glowRing = new THREE.Mesh(new THREE.TorusGeometry(0.315, 0.016, 10, 64), accent);
      glowRing.rotation.y = Math.PI / 2;
      glowRing.position.x = side * 0.125;
      const ear = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.085, 16, 48), cushion);
      ear.rotation.y = Math.PI / 2;
      ear.position.x = -side * 0.13;
      cup.add(shell, cap, glowRing, ear);
      head.add(slider, cup);
    });

    // Orbit ring, laid nearly flat and tilted, with a light travelling along it.
    const ringPivot = new THREE.Group();
    ringPivot.rotation.set(-(Math.PI / 2 - 0.32), 0, -0.2, 'ZYX');
    head.add(ringPivot);
    ringPivot.add(new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.016, 12, 256), accent));
    ringPivot.add(new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.05, 12, 256), accentSoft));
    const comet = new THREE.Group();
    comet.add(new THREE.Mesh(new THREE.SphereGeometry(0.038, 16, 16), new THREE.MeshBasicMaterial({ color: '#FFE3CF' })));
    const cometGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialTexture([[0, 'rgba(255, 170, 110, 0.9)'], [0.4, 'rgba(254, 119, 37, 0.35)'], [1, 'rgba(254, 119, 37, 0)']]),
      transparent: true,
      depthWrite: false,
    }));
    cometGlow.scale.set(0.32, 0.32, 1);
    comet.add(cometGlow);
    ringPivot.add(comet);

    /* ---------- the stand ---------- */
    const stage = new THREE.Group();
    stage.position.y = STAND_Y;
    scene.add(stage);
    const standTop = new THREE.Mesh(
      new THREE.CylinderGeometry(1.25, 1.3, 0.22, 96),
      new THREE.MeshStandardMaterial({ color: '#1C1D23', metalness: 0.55, roughness: 0.3 }),
    );
    standTop.position.y = -0.11;
    const standBase = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.55, 0.16, 96),
      new THREE.MeshStandardMaterial({ color: '#25262D', metalness: 0.5, roughness: 0.4 }),
    );
    standBase.position.y = -0.3;
    const flat = (mesh, y) => { mesh.rotation.x = Math.PI / 2; mesh.position.y = y; return mesh; };
    const rim = flat(new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.02, 12, 160), accent), 0);
    const rimGlow = flat(new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.06, 12, 160), accentSoft), 0);
    const baseRim = flat(new THREE.Mesh(
      new THREE.TorusGeometry(1.5, 0.014, 10, 160),
      new THREE.MeshBasicMaterial({ color: '#FE7725', transparent: true, opacity: 0.7 }),
    ), -0.22);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.18, 64),
      new THREE.MeshBasicMaterial({
        map: radialTexture([[0, 'rgba(255, 160, 100, 0.95)'], [0.5, 'rgba(254, 119, 37, 0.45)'], [1, 'rgba(254, 119, 37, 0)']]),
        transparent: true,
        depthWrite: false,
      }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.003;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.78, 1.12, 0.62, 64, 1, true),
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: ORANGE.clone() }, uLevel: level },
        vertexShader: PLANE_VERT,
        fragmentShader: BEAM_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    beam.position.y = 0.31;
    stage.add(standTop, standBase, rim, rimGlow, baseRim, disc, beam);

    /* ---------- sound waves either side ---------- */
    const sideWaves = [-1, 1].map((side) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.8, 0.82),
        barsMaterial(SIDE_BARS, { size: [0.8, 0.82], barW: 0.014, alpha: 0.5, fade: 1, blending: THREE.NormalBlending }),
      );
      mesh.position.set(side * 1.98, ORB_Y, -0.2);
      mesh.scale.x = side; // mirrored on the left, so both fade away from the orb
      scene.add(mesh);
      return mesh;
    });

    /* ---------- a few motes ---------- */
    const MOTES = 46;
    const motePos = new Float32Array(MOTES * 3);
    for (let i = 0; i < MOTES; i += 1) {
      const r = 1.75 + Math.random() * 0.6;
      const a = Math.random() * Math.PI * 2;
      motePos[i * 3] = Math.cos(a) * r;
      motePos[i * 3 + 1] = ORB_Y + (Math.random() - 0.35) * 2.2;
      motePos[i * 3 + 2] = Math.sin(a) * r * 0.6;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
    const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({
      size: 0.05,
      map: radialTexture([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']]),
      color: '#FF8A45',
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    }));
    scene.add(motes);

    /* ---------- pointer ---------- */
    const pointer = { x: 0, y: 0, over: false };
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1;
    };
    const onEnter = () => { pointer.over = true; };
    const onLeave = () => { pointer.over = false; pointer.x = 0; pointer.y = 0; };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointerleave', onLeave);

    /* ---------- frame ---------- */
    const heights = new Array(BARS).fill(0.2);
    const sideHeights = new Array(SIDE_BARS).fill(0.2);
    const draw = (t) => {
      // A speech-like level: phrases (slow) made of syllables (fast); hovering makes the agent talk.
      const phrase = Math.max(0, Math.sin(t * 0.9) * Math.sin(t * 0.37 + 1.1));
      const syllable = 0.5 + 0.5 * Math.sin(t * 8.5) * Math.sin(t * 3.1 + 0.4);
      const target = pointer.over ? 0.7 + 0.3 * syllable : 0.18 + 0.6 * phrase * (0.55 + 0.45 * syllable);
      level.value += (target - level.value) * 0.08;
      const lv = level.value;

      // Waveform: tallest in the middle, each bar on its own rhythm.
      const uBars = bars.material.uniforms.uBars.value;
      for (let k = 0; k < BARS; k += 1) {
        const centre = 1 - Math.abs(k - (BARS - 1) / 2) / ((BARS - 1) / 2);
        const jitter = 0.5 + 0.5 * Math.sin(t * 6.3 + k * 1.7) * Math.sin(t * 2.9 + k * 0.63);
        const want = 0.1 + (0.25 + 0.75 * centre) * (0.2 + 0.8 * lv) * (0.35 + 0.65 * jitter);
        heights[k] += (Math.min(want, 1) - heights[k]) * 0.22;
        uBars[k] = heights[k];
      }
      for (let k = 0; k < SIDE_BARS; k += 1) {
        const jitter = 0.5 + 0.5 * Math.sin(t * 4.1 + k * 2.3) * Math.sin(t * 1.7 + k);
        const want = (0.15 + 0.6 * lv) * (0.3 + 0.7 * jitter) * (1 - k / (SIDE_BARS + 2));
        sideHeights[k] += (want - sideHeights[k]) * 0.18;
      }
      sideWaves.forEach((w) => { w.material.uniforms.uBars.value = sideHeights; });

      innerGlow.material.opacity = 0.7 + 0.3 * lv;
      disc.material.opacity = 0.7 + 0.3 * lv;

      head.position.y = ORB_Y + Math.sin(t * 1.2) * 0.045;
      head.rotation.y += ((pointer.x * 0.45 + Math.sin(t * 0.4) * 0.12) - head.rotation.y) * 0.05;
      head.rotation.x += ((pointer.y * 0.18) - head.rotation.x) * 0.05;
      const a = t * (pointer.over ? 1.1 : 0.6);
      comet.position.set(Math.cos(a) * 1.5, Math.sin(a) * 1.5, 0);
      motes.rotation.y = t * 0.05;

      renderer.render(scene, camera);
    };

    /* ---------- loop control: only while visible ---------- */
    const clock = new THREE.Clock();
    let raf = 0;
    let running = false;
    let inView = true;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      draw(clock.getElapsedTime());
    };
    const start = () => {
      if (running || reduced || !inView || document.hidden) return;
      running = true;
      tick();
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    let io;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        if (inView) start(); else stop();
      });
      io.observe(el);
    }
    const onVisibility = () => { if (document.hidden) stop(); else start(); };
    document.addEventListener('visibilitychange', onVisibility);

    const resize = () => {
      renderer.setSize(width(), height(), false);
      frame();
      if (!running) draw(reduced ? 2.4 : clock.getElapsedTime());
    };
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(resize);
      ro.observe(el);
    }

    if (reduced) draw(2.4); else start();

    return () => {
      stop();
      io?.disconnect();
      ro?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointerleave', onLeave);
      scene.traverse((obj) => {
        obj.geometry?.dispose();
        [].concat(obj.material ?? []).forEach((m) => {
          m.map?.dispose();
          m.dispose();
        });
      });
      envMap.dispose();
      room.dispose?.();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (canvas.parentNode === el) el.removeChild(canvas);
    };
  }, []);

  return <div ref={mountRef} className={className} />;
}
