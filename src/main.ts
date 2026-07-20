import "./style.css";

// ---------------------------------------------------------------------------
// Windows XP themed pinball — single canvas game, no external assets.
// Board is 440 x 720 internal units, scaled to fit via CSS.
// ---------------------------------------------------------------------------

const W = 440;
const H = 720;

const canvas = document.querySelector<HTMLCanvasElement>("#board")!;
const ctx = canvas.getContext("2d")!;

const scoreEl = document.querySelector<HTMLDivElement>("#score")!;
const highscoreEl = document.querySelector<HTMLDivElement>("#highscore")!;
const ballsEl = document.querySelector<HTMLDivElement>("#balls")!;
const statusEl = document.querySelector<HTMLSpanElement>("#status-text")!;
const overlay = document.querySelector<HTMLDivElement>("#overlay")!;
const overlayTitle = document.querySelector<HTMLDivElement>("#overlay-title")!;
const overlayMsg = document.querySelector<HTMLDivElement>("#overlay-msg")!;
const overlayBtn = document.querySelector<HTMLButtonElement>("#overlay-btn")!;
const launchBtn = document.querySelector<HTMLButtonElement>("#launch-btn")!;
const levelEl = document.querySelector<HTMLSpanElement>("#level")!;
const missionNameEl = document.querySelector<HTMLDivElement>("#mission-name")!;
const missionProgressEl = document.querySelector<HTMLDivElement>("#mission-progress")!;
const missionBanner = document.querySelector<HTMLDivElement>("#mission-banner")!;
const missionBannerText = document.querySelector<HTMLDivElement>("#mission-banner-text")!;
let bannerTimer: ReturnType<typeof setTimeout> | null = null;

// ---- clock in the taskbar --------------------------------------------------
const clockEl = document.querySelector<HTMLDivElement>("#clock")!;
function tickClock() {
  const now = new Date();
  let h = now.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  const m = now.getMinutes().toString().padStart(2, "0");
  clockEl.textContent = `${h}:${m} ${ampm}`;
}
tickClock();
setInterval(tickClock, 1000 * 15);

// ---- Clippy pep-talk assistant --------------------------------------------
const clippyBubble = document.querySelector<HTMLDivElement>("#clippy-bubble")!;
const CLIPPY_LINES = [
  "It looks like you're playing pinball. You've got this!",
  "Nice flip! Keep that combo going.",
  "Tip: tap the lane early to charge the plunger just right.",
  "Every ball drop is a fresh chance at a high score.",
  "You're doing great — don't forget to breathe.",
  "That bumper didn't stand a chance!",
  "Believe in yourself. The ball certainly believes in gravity.",
  "Pro tip: the flippers work best when you actually use them.",
  "Looking sharp today! Ready for a new high score?",
  "Remember: it's not a loss, it's a warm-up round.",
  "You miss 100% of the flips you don't take.",
  "I'd offer to hold the ball for you, but I don't have hands.",
  "It looks like you're aiming for a ramp shot. Timing is everything!",
  "Clear that mission ladder and I hear good things happen.",
  "That upper flipper up top isn't just for show, you know.",
];
let clippyTimer: ReturnType<typeof setTimeout> | null = null;
let clippyHideTimer: ReturnType<typeof setTimeout> | null = null;

function showClippyLine() {
  const line = CLIPPY_LINES[Math.floor(Math.random() * CLIPPY_LINES.length)];
  clippyBubble.textContent = line;
  clippyBubble.classList.add("visible");
  if (clippyHideTimer) clearTimeout(clippyHideTimer);
  clippyHideTimer = setTimeout(() => {
    clippyBubble.classList.remove("visible");
  }, 4200);
}

function scheduleClippy() {
  if (clippyTimer) clearTimeout(clippyTimer);
  const delay = 6000 + Math.random() * 9000;
  clippyTimer = setTimeout(() => {
    if (gameRunning && !paused) showClippyLine();
    scheduleClippy();
  }, delay);
}
scheduleClippy();

// ---------------------------------------------------------------------------
// Sound effects — synthesized via Web Audio API, no external asset files.
// A single shared AudioContext is created lazily on first user interaction
// (autoplay policies block audio before any gesture).
// ---------------------------------------------------------------------------
let audioCtx: AudioContext | null = null;
let sfxMuted = false;

function getAudioCtx(): AudioContext | null {
  if (sfxMuted) return null;
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playTone(
  freq: number,
  duration: number,
  opts: { type?: OscillatorType; gain?: number; freqEnd?: number; delay?: number } = {}
) {
  const ac = getAudioCtx();
  if (!ac) return;
  const { type = "square", gain = 0.18, freqEnd, delay = 0 } = opts;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gainNode = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + duration);
  }
  gainNode.gain.setValueAtTime(gain, t0);
  gainNode.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gainNode).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function playNoiseBurst(duration: number, gain = 0.15) {
  const ac = getAudioCtx();
  if (!ac) return;
  const bufferSize = Math.max(1, Math.floor(ac.sampleRate * duration));
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const gainNode = ac.createGain();
  gainNode.gain.setValueAtTime(gain, ac.currentTime);
  src.connect(gainNode).connect(ac.destination);
  src.start();
}

const sfx = {
  flipper() {
    playTone(220, 0.06, { type: "square", gain: 0.12, freqEnd: 160 });
  },
  bumper(points: number) {
    // higher-value bumpers ring a touch higher
    const base = 340 + Math.min(points, 200) * 0.6;
    playTone(base, 0.14, { type: "triangle", gain: 0.2, freqEnd: base * 1.8 });
    playTone(base * 1.5, 0.1, { type: "sine", gain: 0.1, delay: 0.02 });
  },
  target() {
    playTone(500, 0.08, { type: "square", gain: 0.16, freqEnd: 900 });
  },
  slingshot() {
    playTone(180, 0.1, { type: "sawtooth", gain: 0.14, freqEnd: 90 });
  },
  launch() {
    playTone(120, 0.32, { type: "sawtooth", gain: 0.2, freqEnd: 640 });
  },
  drain() {
    playTone(320, 0.4, { type: "sine", gain: 0.16, freqEnd: 60 });
    playNoiseBurst(0.15, 0.08);
  },
  gameOver() {
    playTone(392, 0.16, { type: "square", gain: 0.18 });
    playTone(330, 0.16, { type: "square", gain: 0.18, delay: 0.16 });
    playTone(262, 0.3, { type: "square", gain: 0.18, delay: 0.32 });
  },
  start() {
    playTone(262, 0.1, { type: "square", gain: 0.16 });
    playTone(392, 0.1, { type: "square", gain: 0.16, delay: 0.1 });
    playTone(523, 0.16, { type: "square", gain: 0.16, delay: 0.2 });
  },
  ui() {
    playTone(700, 0.05, { type: "square", gain: 0.1 });
  },
  combo() {
    playTone(880, 0.07, { type: "square", gain: 0.12 });
  },
};

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------
interface Vec {
  x: number;
  y: number;
}

function sub(a: Vec, b: Vec): Vec {
  return { x: a.x - b.x, y: a.y - b.y };
}
function add(a: Vec, b: Vec): Vec {
  return { x: a.x + b.x, y: a.y + b.y };
}
function scale(a: Vec, s: number): Vec {
  return { x: a.x * s, y: a.y * s };
}
function dot(a: Vec, b: Vec): number {
  return a.x * b.x + a.y * b.y;
}
function len(a: Vec): number {
  return Math.sqrt(a.x * a.x + a.y * a.y);
}
function norm(a: Vec): Vec {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
}

// Closest point on segment AB to point P
function closestOnSegment(p: Vec, a: Vec, b: Vec): { point: Vec; t: number } {
  const ab = sub(b, a);
  const abLen2 = dot(ab, ab) || 1;
  let t = dot(sub(p, a), ab) / abLen2;
  t = Math.max(0, Math.min(1, t));
  return { point: add(a, scale(ab, t)), t };
}

// ---------------------------------------------------------------------------
// Static wall segments (line collisions), plus curved arcs approximated by
// short segment chains for the rounded top of the playfield.
// ---------------------------------------------------------------------------
interface Segment {
  a: Vec;
  b: Vec;
}

const WALL_MARGIN = 10;
const LANE_X = 400; // divider between play field and launch lane (narrowed so the ball can't easily drift back in from the field)
const LANE_TOP = 230; // where the lane divider ends and merges into the dome arc

const walls: Segment[] = [];

function addSeg(a: Vec, b: Vec) {
  walls.push({ a, b });
}

// Left outer wall
addSeg({ x: WALL_MARGIN, y: 230 }, { x: WALL_MARGIN, y: H - WALL_MARGIN });
// Rounded top-left arc approximated
{
  const cx = W / 2;
  const cy = 230;
  const r = W / 2 - WALL_MARGIN;
  const steps = 14;
  let prev: Vec = { x: WALL_MARGIN, y: 230 };
  for (let i = 1; i <= steps; i++) {
    const t = Math.PI + (i / steps) * Math.PI; // from 180deg to 360deg (top arc)
    const p = { x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) };
    addSeg(prev, p);
    prev = p;
  }
}
// Lane divider wall (separates launch lane from play field). It stops exactly
// where the dome arc reaches the right outer wall (LANE_TOP = 230, same y as
// the arc's right endpoint), so a ball launched up the lane sails straight
// past the divider into open space that is already inside the dome's circle —
// no separate deflector needed, the arc itself curves the ball left from
// there. Below LANE_TOP it's a solid one-way wall: ball enters the field from
// above and never re-enters the lane, since gravity sends it down into the
// field, not back up through the narrow gap.
addSeg({ x: LANE_X, y: LANE_TOP }, { x: LANE_X, y: H - 140 });

// Left slingshot (angled kicker wall above left flipper)
const leftSling: Segment = { a: { x: WALL_MARGIN, y: H - 190 }, b: { x: 130, y: H - 140 } };
addSeg(leftSling.a, leftSling.b);
// Right slingshot — anchored to the playfield's actual right boundary
// (LANE_X, the lane divider) rather than the outer wall, since x > LANE_X is
// the separate launch lane, not part of the playfield.
const rightSling: Segment = { a: { x: LANE_X, y: H - 190 }, b: { x: W - 140, y: H - 140 } };
addSeg(rightSling.a, rightSling.b);

// Lower side walls funneling toward flippers
addSeg({ x: WALL_MARGIN, y: H - 190 }, { x: WALL_MARGIN, y: H - 30 });
addSeg({ x: W - WALL_MARGIN, y: H - 190 }, { x: W - WALL_MARGIN, y: H - 30 });

// Launch lane outer wall (right edge), merging directly with the dome arc's
// right endpoint at LANE_TOP — plus the plunger channel bottom.
addSeg({ x: W - WALL_MARGIN, y: LANE_TOP }, { x: W - WALL_MARGIN, y: H - WALL_MARGIN });
addSeg({ x: LANE_X, y: H - 140 }, { x: LANE_X, y: H - WALL_MARGIN });

// ---------------------------------------------------------------------------
// Bumpers — round pop bumpers themed as classic XP icons
// ---------------------------------------------------------------------------
interface Bumper {
  pos: Vec;
  r: number;
  color: string;
  glow: string;
  label: string;
  hitFlash: number;
  points: number;
}

const bumpers: Bumper[] = [
  { pos: { x: 150, y: 260 }, r: 24, color: "#1a5fd6", glow: "#7fb6ff", label: "e", hitFlash: 0, points: 100 },
  { pos: { x: 290, y: 260 }, r: 24, color: "#2f9c2f", glow: "#9be89b", label: "\u267B", hitFlash: 0, points: 100 },
  { pos: { x: 220, y: 340 }, r: 26, color: "#e0a800", glow: "#ffe08a", label: "\u25B6", hitFlash: 0, points: 150 },
];

// Drop-target style rectangular bonus targets
interface Target {
  pos: Vec;
  w: number;
  h: number;
  hit: boolean;
  flash: number;
}
const targets: Target[] = [
  { pos: { x: 90, y: 420 }, w: 30, h: 14, hit: false, flash: 0 },
  { pos: { x: 205, y: 420 }, w: 30, h: 14, hit: false, flash: 0 },
  { pos: { x: 320, y: 420 }, w: 30, h: 14, hit: false, flash: 0 },
];

// ---------------------------------------------------------------------------
// Flippers
// ---------------------------------------------------------------------------
class Flipper {
  pivot: Vec;
  length: number;
  restAngle: number;
  activeAngle: number;
  angle: number;
  angularVel = 0;
  active = false;
  side: "left" | "right";
  radius = 11;

  constructor(pivot: Vec, length: number, restAngle: number, activeAngle: number, side: "left" | "right") {
    this.pivot = pivot;
    this.length = length;
    this.restAngle = restAngle;
    this.activeAngle = activeAngle;
    this.angle = restAngle;
    this.side = side;
  }

  update(dt: number) {
    const target = this.active ? this.activeAngle : this.restAngle;
    const prevAngle = this.angle;
    const speed = 22; // rad/s approach rate
    const diff = target - this.angle;
    const step = Math.sign(diff) * Math.min(Math.abs(diff), speed * dt);
    this.angle += step;
    this.angularVel = dt > 0 ? (this.angle - prevAngle) / dt : 0;
  }

  tip(): Vec {
    return {
      x: this.pivot.x + Math.cos(this.angle) * this.length,
      y: this.pivot.y + Math.sin(this.angle) * this.length,
    };
  }
}

const FLIPPER_LEN = 78;
const leftFlipper = new Flipper(
  { x: 128, y: H - 108 },
  FLIPPER_LEN,
  Math.PI * 0.28, // resting: pointing down-right
  -Math.PI * 0.28, // active: pointing up-right
  "left"
);
const rightFlipper = new Flipper(
  { x: W - 128, y: H - 108 },
  FLIPPER_LEN,
  Math.PI - Math.PI * 0.28, // resting: pointing down-left
  Math.PI + Math.PI * 0.28, // active: pointing up-left
  "right"
);

// Third flipper: a shorter upper-left flipper, angled the same way as the
// main left flipper (rests pointing down-right, flips up-right). Positioned
// roughly halfway down the field so it can bat a ball coming out of the
// bumper cluster back into play, and shares control with either flipper key.
const centerFlipper = new Flipper(
  { x: 70, y: 360 },
  50,
  Math.PI * 0.28, // resting: pointing down-right
  -Math.PI * 0.28, // active: pointing up-right
  "left"
);

// ---------------------------------------------------------------------------
// Ramps — simplified as capture/launch "loop" shots rather than full physical
// tubes: hitting the mouth while moving upward with enough speed captures the
// ball and re-emits it near the top of the field, same feel as an orbit/ramp
// shot on a real table, without needing a separate rendering layer.
// ---------------------------------------------------------------------------
interface Ramp {
  name: string;
  mouth: Vec;
  r: number;
  exit: Vec;
  exitVel: Vec;
  color: string;
  glow: string;
  hits: number;
  cooldown: number;
  flash: number;
}

const ramps: Ramp[] = [
  {
    name: "Recycle Ramp",
    mouth: { x: 52, y: 475 },
    r: 17,
    exit: { x: 108, y: 214 },
    exitVel: { x: 90, y: 260 },
    color: "#2f9c2f",
    glow: "#9be89b",
    hits: 0,
    cooldown: 0,
    flash: 0,
  },
  {
    name: "Update Ramp",
    mouth: { x: W - 52, y: 475 },
    r: 17,
    exit: { x: W - 108, y: 214 },
    exitVel: { x: -90, y: 260 },
    color: "#1a5fd6",
    glow: "#7fb6ff",
    hits: 0,
    cooldown: 0,
    flash: 0,
  },
];

// ---------------------------------------------------------------------------
// Ball
// ---------------------------------------------------------------------------
const BALL_R = 9;

interface BallState {
  pos: Vec;
  vel: Vec;
  active: boolean;
}

const plungerRestPos: Vec = { x: (LANE_X + (W - WALL_MARGIN)) / 2, y: H - 60 };

const ball: BallState = {
  pos: { ...plungerRestPos },
  vel: { x: 0, y: 0 },
  active: false,
};

// Bonus multiball balls, awarded for clearing the mission ladder. They share
// all the same physics/collision handling as the main ball but don't cost a
// life when drained — losing them just ends the multiball bonus.
let extraBalls: BallState[] = [];
let multiballActive = false;

function activeBalls(): BallState[] {
  const list: BallState[] = [];
  if (ball.active) list.push(ball);
  list.push(...extraBalls);
  return list;
}

let plungerCharge = 0; // 0..1
let plungerCharging = false;



// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------
let score = 0;
let highScore = Number(localStorage.getItem("xp-pinball-highscore") || 0);
let ballsLeft = 3;
let gameRunning = false;
let paused = false;
let comboMultiplier = 1;
let comboTimer = 0;

// ---------------------------------------------------------------------------
// Mission ladder — four Windows-XP-themed objectives per level. Clearing all
// four triggers a multiball bonus and bumps the level, scaling every
// threshold up and nudging gravity a little harder for the next lap.
// ---------------------------------------------------------------------------
let level = 1;
let missionIndex = 0;
let bumperHits = 0;
let targetClears = 0;
let rampHitsTotal = 0;
let levelScore = 0; // score earned since the current level started

interface Mission {
  name: string;
  target: (lvl: number) => number;
  progress: () => number;
}

const MISSIONS: Mission[] = [
  { name: "Boot Windows", target: (lvl) => 15 + (lvl - 1) * 5, progress: () => bumperHits },
  { name: "Empty Recycle Bin", target: (lvl) => 3 + (lvl - 1), progress: () => targetClears },
  { name: "Run Disk Defragmenter", target: (lvl) => 6 + (lvl - 1) * 2, progress: () => rampHitsTotal },
  { name: "Install Updates", target: (lvl) => 2500 + (lvl - 1) * 1000, progress: () => levelScore },
];

const GRAVITY_BASE = 620;
function currentGravity(): number {
  return Math.min(GRAVITY_BASE + (level - 1) * 18, 760);
}

function showBanner(text: string, ms = 2200) {
  missionBanner.classList.add("show");
  missionBannerText.innerHTML = text;
  if (bannerTimer) clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => missionBanner.classList.remove("show"), ms);
}

function updateMissionHud() {
  const m = MISSIONS[missionIndex];
  levelEl.textContent = String(level);
  if (!m) {
    missionNameEl.textContent = "System Restore Ready";
    missionProgressEl.textContent = "";
    return;
  }
  missionNameEl.textContent = m.name;
  missionProgressEl.textContent = `${Math.min(m.progress(), m.target(level))} / ${m.target(level)}`;
}

function spawnMultiball() {
  multiballActive = true;
  const spawnOne = (delayMs: number) => {
    setTimeout(() => {
      if (!gameRunning) return;
      extraBalls.push({
        pos: { ...plungerRestPos },
        vel: { x: (Math.random() - 0.5) * 120, y: -(700 + Math.random() * 200) },
        active: true,
      });
      sfx.launch();
    }, delayMs);
  };
  spawnOne(150);
  spawnOne(650);
  statusEl.textContent = "Multiball!";
}

function advanceMission() {
  const m = MISSIONS[missionIndex];
  if (!m) return;
  if (m.progress() >= m.target(level)) {
    missionIndex++;
    addScore(300);
    if (missionIndex >= MISSIONS.length) {
      // Ladder cleared — big bonus, level up, reset counters, go multiball.
      const bonus = 2000 * level;
      addScore(bonus);
      showBanner(`SYSTEM RESTORE POINT CREATED!<br/>+${fmt(bonus)} — Level ${level + 1} · Multiball!`, 2800);
      sfx.combo();
      level += 1;
      missionIndex = 0;
      bumperHits = 0;
      targetClears = 0;
      rampHitsTotal = 0;
      levelScore = 0;
      spawnMultiball();
    } else {
      showBanner(`Mission complete: ${m.name}!<br/>Next up: ${MISSIONS[missionIndex].name}`);
      sfx.combo();
    }
    updateMissionHud();
  }
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function updateHud() {
  scoreEl.textContent = fmt(score);
  highscoreEl.textContent = fmt(highScore);
  ballsEl.textContent = String(Math.max(ballsLeft, 0));
  updateMissionHud();
}

function addScore(n: number) {
  const gained = Math.round(n * comboMultiplier * (multiballActive ? 2 : 1));
  score += gained;
  levelScore += gained;
  comboMultiplier = Math.min(comboMultiplier + 0.15, 4);
  comboTimer = 2.2;
  if (score > highScore) {
    highScore = score;
    localStorage.setItem("xp-pinball-highscore", String(highScore));
  }
  updateHud();
}

function resetBallToPlunger() {
  ball.pos = { ...plungerRestPos };
  ball.vel = { x: 0, y: 0 };
  ball.active = false;
}

function resetTargets() {
  for (const t of targets) {
    t.hit = false;
    t.flash = 0;
  }
}

function startNewGame() {
  score = 0;
  ballsLeft = 3;
  comboMultiplier = 1;
  level = 1;
  missionIndex = 0;
  bumperHits = 0;
  targetClears = 0;
  rampHitsTotal = 0;
  levelScore = 0;
  multiballActive = false;
  extraBalls = [];
  resetTargets();
  gameRunning = true;
  paused = false;
  resetBallToPlunger();
  updateHud();
  updateMissionHud();
  overlay.classList.add("hidden");
  statusEl.textContent = "Ball 1 — pull back and release to launch";
  sfx.start();
}

function loseBall() {
  sfx.drain();
  // Bonus multiball balls don't cost a life — losing the last of them just
  // ends the bonus round.
  if (multiballActive && extraBalls.length === 0) {
    multiballActive = false;
    statusEl.textContent = "Multiball over";
  }
  ballsLeft -= 1;
  updateHud();
  if (ballsLeft <= 0) {
    gameRunning = false;
    overlayTitle.textContent = "Game Over";
    overlayMsg.textContent = `Final score: ${fmt(score)}${score >= highScore && score > 0 ? " — new high score!" : ""}`;
    overlayBtn.textContent = "Play Again";
    overlay.classList.remove("hidden");
    statusEl.textContent = "Game over";
    sfx.gameOver();
  } else {
    const ballBonus = level * 200;
    addScore(ballBonus);
    resetBallToPlunger();
    statusEl.textContent = `Ball ${4 - ballsLeft} bonus +${fmt(ballBonus)} — pull back and release to launch`;
  }
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
const keys = new Set<string>();

window.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight", " ", "Spacebar"].includes(e.key)) e.preventDefault();
  keys.add(e.key);
  if (e.key === "ArrowLeft" || e.key === "z" || e.key === "Z") {
    if (!leftFlipper.active) sfx.flipper();
    leftFlipper.active = true;
  }
  if (e.key === "ArrowRight" || e.key === "m" || e.key === "M") {
    if (!rightFlipper.active) sfx.flipper();
    rightFlipper.active = true;
  }
  if (e.key === " " || e.key === "Spacebar") {
    if (gameRunning && !ball.active) plungerCharging = true;
  }
  if ((e.key === "p" || e.key === "P") && gameRunning) {
    paused = !paused;
    statusEl.textContent = paused ? "Paused" : "Playing";
  }
});

window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft" || e.key === "z" || e.key === "Z") leftFlipper.active = false;
  if (e.key === "ArrowRight" || e.key === "m" || e.key === "M") rightFlipper.active = false;
  if (e.key === " " || e.key === "Spacebar") {
    if (plungerCharging) {
      launchBall();
    }
    plungerCharging = false;
  }
});

// touch support: tap left/right half of canvas = flippers, tap+hold bottom = plunger
canvas.addEventListener("touchstart", (e) => {
  for (const t of Array.from(e.changedTouches)) {
    const rect = canvas.getBoundingClientRect();
    const x = ((t.clientX - rect.left) / rect.width) * W;
    const y = ((t.clientY - rect.top) / rect.height) * H;
    if (y > H - 200) {
      if (x < W / 2) {
        if (!leftFlipper.active) sfx.flipper();
        leftFlipper.active = true;
      } else {
        if (!rightFlipper.active) sfx.flipper();
        rightFlipper.active = true;
      }
    }
    if (!ball.active && x > LANE_X) plungerCharging = true;
  }
  e.preventDefault();
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
  leftFlipper.active = false;
  rightFlipper.active = false;
  if (plungerCharging) launchBall();
  plungerCharging = false;
  e.preventDefault();
}, { passive: false });

function launchBall() {
  if (ball.active || !gameRunning) {
    plungerCharge = 0;
    return;
  }
  const power = 500 + plungerCharge * 900;
  ball.vel = { x: 0, y: -power };
  ball.active = true;
  plungerCharge = 0;
  statusEl.textContent = "Playing";
  sfx.launch();
}

overlayBtn.addEventListener("click", () => {
  sfx.ui();
  startNewGame();
});
launchBtn.addEventListener("click", () => {
  sfx.ui();
  startNewGame();
});

document.querySelector(".tbtn.close")?.addEventListener("click", () => {
  sfx.ui();
  overlayTitle.textContent = "Windows XP Pinball";
  overlayMsg.textContent = "Program closed. Click Start to reopen.";
  overlayBtn.textContent = "Start";
  overlay.classList.remove("hidden");
  gameRunning = false;
});
document.querySelector(".tbtn.min")?.addEventListener("click", () => {
  sfx.ui();
  statusEl.textContent = "Minimized (nothing to see here)";
});
document.querySelector(".tbtn.max")?.addEventListener("click", () => {
  sfx.ui();
  statusEl.textContent = "This window is already sized just right";
});

const muteBtn = document.querySelector<HTMLButtonElement>("#mute-btn")!;
muteBtn.addEventListener("click", () => {
  sfxMuted = !sfxMuted;
  muteBtn.textContent = sfxMuted ? "\u{1F507}" : "\u{1F50A}";
  muteBtn.classList.toggle("is-muted", sfxMuted);
  muteBtn.title = sfxMuted ? "Unmute sound" : "Mute sound";
  if (!sfxMuted) sfx.ui();
});

// ---------------------------------------------------------------------------
// Collision resolution
// ---------------------------------------------------------------------------
// One-way gate at the mouth of the launch lane (where the straight lane
// divider ends and the dome arc begins, y = LANE_TOP). A ball launched from
// the plunger travels straight up (near-zero horizontal velocity) and passes
// through untouched. A ball returning from the open field always picks up
// meaningful horizontal velocity from the dome curve/bumpers/flippers before
// it can line back up with the narrow lane mouth, so that case gets deflected
// back out into play instead of being allowed to drop back into the lane.
function enforceLaneGate(b: BallState) {
  const gateY = LANE_TOP + BALL_R + 2;
  if (
    b.pos.x > LANE_X + BALL_R &&
    b.pos.x < W - WALL_MARGIN - BALL_R &&
    b.pos.y > LANE_TOP - 6 &&
    b.pos.y < gateY + 18 &&
    b.vel.y > 0 &&
    Math.abs(b.vel.x) > 25
  ) {
    b.pos.y = LANE_TOP - 6;
    b.vel.y = -Math.abs(b.vel.y) * 0.5 - 80;
    b.vel.x = -Math.abs(b.vel.x) - 40;
  }
}

function collideWalls(b: BallState) {
  for (const seg of walls) {
    const { point } = closestOnSegment(b.pos, seg.a, seg.b);
    const diff = sub(b.pos, point);
    const d = len(diff);
    if (d < BALL_R && d > 0.0001) {
      const n = norm(diff);
      const overlap = BALL_R - d;
      b.pos = add(b.pos, scale(n, overlap));
      const vn = dot(b.vel, n);
      if (vn < 0) {
        b.vel = sub(b.vel, scale(n, vn * 1.75)); // reflect + slight damping via 1.75 instead of 2
      }
    }
  }
}

function collideBumpers(b: BallState) {
  for (const bump of bumpers) {
    const diff = sub(b.pos, bump.pos);
    const d = len(diff);
    const minD = BALL_R + bump.r;
    if (d < minD && d > 0.0001) {
      const n = norm(diff);
      b.pos = add(b.pos, scale(n, minD - d));
      const speed = Math.max(len(b.vel), 260);
      b.vel = scale(n, speed * 1.15 + 60);
      bump.hitFlash = 1;
      bumperHits += 1;
      addScore(bump.points);
      sfx.bumper(bump.points);
      statusEl.textContent = `+${bump.points} combo x${comboMultiplier.toFixed(1)}`;
      advanceMission();
    }
  }
}

function collideTargets(b: BallState) {
  for (const t of targets) {
    if (t.hit) continue;
    const closestX = Math.max(t.pos.x - t.w / 2, Math.min(b.pos.x, t.pos.x + t.w / 2));
    const closestY = Math.max(t.pos.y - t.h / 2, Math.min(b.pos.y, t.pos.y + t.h / 2));
    const dx = b.pos.x - closestX;
    const dy = b.pos.y - closestY;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < BALL_R) {
      const n = d > 0.0001 ? { x: dx / d, y: dy / d } : { x: 0, y: -1 };
      b.pos = add(b.pos, scale(n, BALL_R - d + 0.5));
      const vn = dot(b.vel, n);
      if (vn < 0) b.vel = sub(b.vel, scale(n, vn * 1.6));
      t.flash = 1;
      t.hit = true;
      addScore(50);
      sfx.target();
      if (targets.every((tt) => tt.hit)) {
        addScore(500);
        targetClears += 1;
        sfx.combo();
        statusEl.textContent = "Bonus! All targets +500";
        advanceMission();
        setTimeout(resetTargets, 500);
      }
    }
  }
}

function collideFlipper(f: Flipper, b: BallState) {
  const tip = f.tip();
  const { point } = closestOnSegment(b.pos, f.pivot, tip);
  const diff = sub(b.pos, point);
  const d = len(diff);
  const minD = BALL_R + f.radius;
  if (d < minD && d > 0.0001) {
    const n = norm(diff);
    b.pos = add(b.pos, scale(n, minD - d));
    // approximate tangential velocity of the flipper surface at contact point
    const r = sub(point, f.pivot);
    const tangential = { x: -r.y * f.angularVel, y: r.x * f.angularVel };
    const vn = dot(b.vel, n);
    if (vn < 0) {
      b.vel = sub(b.vel, scale(n, vn * 1.9));
    }
    // kick from flipper motion
    b.vel = add(b.vel, scale(tangential, 0.9));
  }
}

function collideRamps(b: BallState) {
  for (const r of ramps) {
    if (r.cooldown > 0) continue;
    const diff = sub(b.pos, r.mouth);
    const d = len(diff);
    if (d < r.r && b.vel.y < -60) {
      const speed = len(b.vel);
      const boost = Math.min(1.3, 0.7 + speed / 900);
      b.pos = { ...r.exit };
      b.vel = scale(r.exitVel, boost);
      r.hits += 1;
      r.flash = 1;
      r.cooldown = 0.6;
      rampHitsTotal += 1;
      addScore(120);
      sfx.combo();
      statusEl.textContent = `${r.name} shot! +120`;
      advanceMission();
    }
  }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
let lastTime = performance.now();

function step(dt: number) {
  leftFlipper.update(dt);
  rightFlipper.update(dt);
  centerFlipper.active = leftFlipper.active || rightFlipper.active;
  centerFlipper.update(dt);

  for (const bump of bumpers) bump.hitFlash = Math.max(0, bump.hitFlash - dt * 3);
  for (const t of targets) t.flash = Math.max(0, t.flash - dt * 3);
  for (const r of ramps) {
    r.flash = Math.max(0, r.flash - dt * 2);
    r.cooldown = Math.max(0, r.cooldown - dt);
  }
  comboTimer -= dt;
  if (comboTimer <= 0) comboMultiplier = 1;

  if (plungerCharging) {
    plungerCharge = Math.min(1, plungerCharge + dt * 1.6);
  }

  if (!gameRunning || paused) return;

  const gravity = currentGravity();
  const subSteps = 3;
  const sdt = dt / subSteps;

  for (const b of activeBalls()) {
    b.vel.y += gravity * dt;
    for (let i = 0; i < subSteps; i++) {
      b.pos = add(b.pos, scale(b.vel, sdt));
      enforceLaneGate(b);
      collideWalls(b);
      collideBumpers(b);
      collideTargets(b);
      collideRamps(b);
      collideFlipper(leftFlipper, b);
      collideFlipper(rightFlipper, b);
      collideFlipper(centerFlipper, b);
      // speed cap
      const spd = len(b.vel);
      if (spd > 1400) b.vel = scale(b.vel, 1400 / spd);
    }
  }

  if (ball.active && ball.pos.y > H + 40) {
    loseBall();
  }
  if (extraBalls.length > 0) {
    const remaining = extraBalls.filter((b) => b.pos.y <= H + 40);
    if (remaining.length !== extraBalls.length) {
      extraBalls = remaining;
      if (extraBalls.length === 0 && multiballActive) {
        multiballActive = false;
        statusEl.textContent = "Multiball over";
      }
    }
  }
  if (!ball.active) {
    // resting in plunger lane, shift down visually while charging
    ball.pos.y = plungerRestPos.y + plungerCharge * 14;
  }
}

function drawBackground() {
  ctx.fillStyle = "#0a0a12";
  ctx.fillRect(0, 0, W, H);

  // subtle field gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#123a63");
  grad.addColorStop(0.35, "#0d2544");
  grad.addColorStop(1, "#050912");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // XP logo watermark
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.translate(W / 2, 200);
  ctx.font = "bold 46px Tahoma, Verdana, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText("XP", 0, 0);
  ctx.restore();
}

function drawWalls() {
  ctx.strokeStyle = "#9fd3ff";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (const seg of walls) {
    ctx.moveTo(seg.a.x, seg.a.y);
    ctx.lineTo(seg.b.x, seg.b.y);
  }
  ctx.stroke();
}

function drawBumpers() {
  for (const b of bumpers) {
    const glowAmt = b.hitFlash;
    ctx.beginPath();
    ctx.arc(b.pos.x, b.pos.y, b.r + glowAmt * 6, 0, Math.PI * 2);
    ctx.fillStyle = b.color;
    ctx.shadowColor = b.glow;
    ctx.shadowBlur = 8 + glowAmt * 20;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(b.pos.x, b.pos.y, b.r * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = b.color;
    ctx.font = "bold 16px Tahoma, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.label, b.pos.x, b.pos.y + 1);
  }
}

function drawTargets() {
  for (const t of targets) {
    if (t.hit) {
      // dropped: draw as a dim recessed slot instead of a lit block
      ctx.fillStyle = "#3a2020";
      ctx.fillRect(t.pos.x - t.w / 2, t.pos.y - 3, t.w, 6);
      continue;
    }
    ctx.fillStyle = t.flash > 0 ? "#ffef8a" : "#ff6a6a";
    ctx.fillRect(t.pos.x - t.w / 2, t.pos.y - t.h / 2, t.w, t.h);
    ctx.strokeStyle = "#7a1f1f";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(t.pos.x - t.w / 2, t.pos.y - t.h / 2, t.w, t.h);
  }
}

function drawRamps() {
  for (const r of ramps) {
    const glowAmt = r.flash;
    ctx.beginPath();
    ctx.arc(r.mouth.x, r.mouth.y, r.r + glowAmt * 4, 0, Math.PI * 2);
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 4;
    ctx.shadowColor = r.glow;
    ctx.shadowBlur = 6 + glowAmt * 18;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // directional chevron hinting "shoot upward here"
    ctx.fillStyle = r.glow;
    ctx.beginPath();
    ctx.moveTo(r.mouth.x, r.mouth.y - 6);
    ctx.lineTo(r.mouth.x - 6, r.mouth.y + 4);
    ctx.lineTo(r.mouth.x + 6, r.mouth.y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.font = "bold 9px Tahoma, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(String(r.hits), r.mouth.x, r.mouth.y + r.r + 12);
  }
}

function drawFlipper(f: Flipper) {
  const tip = f.tip();
  ctx.strokeStyle = "#e8c94a";
  ctx.lineWidth = f.radius * 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(f.pivot.x, f.pivot.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();
  ctx.strokeStyle = "#8a6d00";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawPlunger() {
  const chargeH = plungerCharge * 60;
  ctx.fillStyle = "#c0c0c0";
  ctx.fillRect(plungerRestPos.x - 6, H - 20 - chargeH, 12, 20 + chargeH);
  ctx.fillStyle = "#7a7a7a";
  ctx.fillRect(plungerRestPos.x - 8, H - 24, 16, 6);
}

function drawOneBall(b: BallState) {
  const grad = ctx.createRadialGradient(b.pos.x - 3, b.pos.y - 3, 1, b.pos.x, b.pos.y, BALL_R);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(1, "#9aa5b1");
  ctx.beginPath();
  ctx.arc(b.pos.x, b.pos.y, BALL_R, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
}

function drawBall() {
  if (ball.active || gameRunning) drawOneBall(ball);
  for (const b of extraBalls) drawOneBall(b);
}

function drawComboBadge() {
  if (comboMultiplier > 1.01) {
    ctx.save();
    ctx.font = "bold 14px Tahoma, sans-serif";
    ctx.fillStyle = "#ffe08a";
    ctx.textAlign = "left";
    ctx.fillText(`Combo x${comboMultiplier.toFixed(1)}`, 16, 30);
    ctx.restore();
  }
}

function render() {
  drawBackground();
  drawWalls();
  drawRamps();
  drawTargets();
  drawBumpers();
  drawFlipper(leftFlipper);
  drawFlipper(rightFlipper);
  drawFlipper(centerFlipper);
  drawPlunger();
  drawBall();
  drawComboBadge();

  if (paused && gameRunning) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 28px Tahoma, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PAUSED", W / 2, H / 2);
  }
}

function loop(now: number) {
  const dt = Math.min(0.032, (now - lastTime) / 1000);
  lastTime = now;
  step(dt);
  render();
  requestAnimationFrame(loop);
}

updateHud();
requestAnimationFrame(loop);
