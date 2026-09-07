let bubbles = [];
let particles = [];
let stars = [];
const maxBubbleCount = 22;
const areaBurstThreshold = .68;
let minRadius = 90;
let maxRadius = 160;
let prevMouseX = 0;
let prevMouseY = 0;
let advancedMode = false;
let challengeMode = 'clean';
let score = 0;
// BEST is intentionally session-memory only; a refresh starts it at zero.
let highScore = 0;
let nextEventAt = 0;
let activeEvent = null;
let cleanRoundEndsAt = 0;
let cleanRoundOver = false;
let cleanPage = 0;
const cleanPageCount = 5;
// 22 native points + 3 split-child points per page, across 5 pages.
const cleanScoreCap = 125;
let cleanNativeRemaining = 0;
let isSettingPopupOpen = false;
let gameCanvas = null;
let challengePaused = false;
let exitConfirmWasPaused = false;
let homeSpawnTimer = null;
let homeInitialSpawned = false;
let previewType = 'normal';

const palette = [
  [244, 167, 185], // pink
  [143, 211, 190], // mint
  [141, 198, 235], // sky
  [248, 218, 132], // yellow
  [190, 175, 235], // lavender
  [245, 164, 126]  // coral
];

function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  gameCanvas = canvas;
  canvas.parent('canvas-wrap');
  canvas.elt.addEventListener('pointerdown', handleCanvasPointerDown, { passive: false });
  pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
  noStroke();
  recalculateBubbleRadius();
  for (let i = 0; i < 90; i++) stars.push({ x: random(width), y: random(height), r: random(.3, 1.4), a: random(18, 70) });
  setupChallengeUI();
  scheduleHomeBubbles();
}

function scheduleHomeBubbles() {
  if (homeSpawnTimer) clearTimeout(homeSpawnTimer);
  homeInitialSpawned = false;
  homeSpawnTimer = setTimeout(() => {
    if (!advancedMode && bubbles.length === 0) spawnHomeBubbles();
  }, 400);
}

function spawnHomeBubbles() {
  if (advancedMode || homeInitialSpawned) return;
  homeInitialSpawned = true;
  const count = floor(random(4, 7));
  for (let i = 0; i < count; i++) {
    // Deliberately use separated regions so the welcome bubbles do not stack.
    const x = map(i, 0, count - 1, width * .12, width * .88) + random(-width * .07, width * .07);
    const y = random(height * .18, height * .78);
    const bubble = new Bubble(constrain(x, minRadius, width - minRadius), constrain(y, minRadius, height - minRadius), true);
    bubble.r = random(minRadius * .55, maxRadius * .62);
    bubble.baseRadius = bubble.r;
    bubbles.push(bubble);
  }
}

function draw() {
  // Opaque clear every frame: bubbles never leave motion trails.
  background(248, 247, 239);
  drawAmbient();
  if (advancedMode && !challengePaused) runAdvancedEvents();
  const scoreNode = document.getElementById('score-display');
  if (advancedMode && scoreNode) {
    const timeLeft = challengeMode === 'clean' ? ` · TIME ${max(0, ceil((cleanRoundEndsAt - millis()) / 1000))}` : '';
    scoreNode.textContent = `SCORE ${min(score, cleanScoreCap)} / ${cleanScoreCap} · BEST ${highScore}${timeLeft}`;
    if (challengeMode === 'clean' && !challengePaused && !cleanRoundOver && millis() >= cleanRoundEndsAt) endCleanRound();
  }

  for (let i = 0; i < bubbles.length && !challengePaused; i++) {
    for (let j = i + 1; j < bubbles.length; j++) resolveBubbleCollision(bubbles[i], bubbles[j]);
  }

  for (let i = bubbles.length - 1; i >= 0; i--) {
    const bubble = bubbles[i];
    if (!challengePaused) bubble.update();
    bubble.draw();
    if (bubble.isDead()) bubbles.splice(i, 1);
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    if (!challengePaused) particles[i].update(); particles[i].draw();
    if (particles[i].isDead()) particles.splice(i, 1);
  }
  if (advancedMode && !challengePaused && challengeMode === 'clean' && !cleanRoundOver && cleanNativeRemaining <= 0) {
    bubbles = [];
    if (cleanPage < cleanPageCount) spawnCleanPage(); else endCleanRound();
  }
}

function drawAmbient() {
  noStroke();
  for (const star of stars) {
    fill(124, 170, 181, star.a * .65);
    circle(star.x, star.y, star.r);
  }
  // Very soft pools of colour give the empty room a little depth.
  fill(255, 219, 188, 12); circle(width * .82, height * .16, min(width, height) * .68);
  fill(177, 225, 223, 13); circle(width * .12, height * .82, min(width, height) * .58);
}

function recalculateBubbleRadius() {
  const shortSide = min(width, height);
  const mobile = window.matchMedia('(max-width:768px)').matches;
  if (mobile) {
    minRadius = shortSide * .085;
    maxRadius = min(shortSide * .145, width * .155); // diameter <= 31vw
  } else {
    minRadius = shortSide * .13;
    maxRadius = shortSide * .23;
  }
}

function aliveBubbleAreaRatio() {
  const occupiedArea = bubbles.reduce((sum, bubble) => {
    return sum + (bubble.isPopped ? 0 : PI * bubble.r * bubble.r);
  }, 0);
  return occupiedArea / (width * height);
}

function shouldCollectivePop() {
  const aliveCount = bubbles.filter(b => !b.isPopped).length;
  return aliveCount > maxBubbleCount || aliveBubbleAreaRatio() >= areaBurstThreshold;
}

function runAdvancedEvents() {
  if (millis() > nextEventAt) {
    activeEvent = random(['breeze', 'mini', 'pulse']);
    nextEventAt = millis() + random(15000, 22000);
    if (activeEvent === 'mini' && bubbles.length < maxBubbleCount) bubbles.push(new Bubble(random(width * .2, width * .8), height * .72, true));
  }
  if (activeEvent === 'breeze') bubbles.forEach(b => { if (!b.isPopped) b.wind += sin(frameCount * .04) * .012; });
}

function setupSettings() {
  const toggle = document.getElementById('settings-toggle');
  const panel = document.getElementById('settings-panel');
  const advancedToggle = document.getElementById('advanced-toggle');
  const options = document.getElementById('advanced-options');
  const scoreDisplay = document.getElementById('score-display');
  const stopUIEvent = event => event.stopPropagation();
  ['mousedown', 'click', 'touchstart'].forEach(eventName => {
    toggle.addEventListener(eventName, stopUIEvent);
    panel.addEventListener(eventName, stopUIEvent);
  });
  toggle.addEventListener('click', () => { isSettingPopupOpen = !isSettingPopupOpen; panel.classList.toggle('is-open', isSettingPopupOpen); });
  // Keep settings interactions inside the panel; do not let them reach the canvas.
  advancedToggle.addEventListener('change', () => {
    advancedMode = advancedToggle.checked; options.classList.toggle('is-hidden', !advancedMode); scoreDisplay.classList.toggle('is-hidden', !advancedMode);
    if (advancedMode) { nextEventAt = millis() + random(15000, 22000); startCleanRound(); isSettingPopupOpen = false; panel.classList.remove('is-open'); }
    else { activeEvent = null; score = 0; cleanRoundOver = false; }
  });
  document.getElementById('play-again').addEventListener('click', startCleanRound);
  document.getElementById('back-home').addEventListener('click', () => {
    advancedToggle.checked = false; advancedMode = false; options.classList.add('is-hidden'); scoreDisplay.classList.add('is-hidden');
    document.getElementById('round-summary').classList.add('is-hidden'); bubbles = []; particles = []; cleanRoundOver = false; isSettingPopupOpen = false; panel.classList.remove('is-open');
  });
}

function setupChallengeUI() {
  const start = document.getElementById('start-challenge');
  const home = document.getElementById('home-challenge-cta');
  const homeCopy = document.getElementById('challenge-home-copy');
  const bubbleGuide = document.getElementById('bubble-guide');
  const controls = document.getElementById('challenge-controls');
  const pauseOverlay = document.getElementById('pause-overlay');
  const exitConfirm = document.getElementById('exit-confirm');
  const roundSummary = document.getElementById('round-summary');
  const scoreDisplay = document.getElementById('score-display');
  const stop = event => event.stopPropagation();
  [start, controls, pauseOverlay, exitConfirm, roundSummary].forEach(node => ['mousedown', 'click', 'touchstart'].forEach(name => node.addEventListener(name, stop)));
  start.addEventListener('click', () => { if (homeSpawnTimer) clearTimeout(homeSpawnTimer); bubbles = []; particles = []; homeInitialSpawned = false; advancedMode = true; homeCopy.classList.add('is-hidden'); bubbleGuide.classList.add('is-hidden'); controls.classList.remove('is-hidden'); scoreDisplay.classList.remove('is-hidden'); startCleanRound(); });
  document.getElementById('pause-button').addEventListener('click', () => { challengePaused = true; controls.classList.add('is-hidden'); pauseOverlay.classList.remove('is-hidden'); });
  document.getElementById('resume-button').addEventListener('click', () => { challengePaused = false; controls.classList.remove('is-hidden'); pauseOverlay.classList.add('is-hidden'); });
  document.getElementById('exit-button').addEventListener('click', openExitConfirm);
  document.getElementById('pause-exit-button').addEventListener('click', openExitConfirm);
  document.getElementById('play-again').addEventListener('click', () => { advancedMode = true; startCleanRound(); });
  document.getElementById('confirm-exit').addEventListener('click', exitChallenge);
  document.getElementById('cancel-exit').addEventListener('click', () => {
    exitConfirm.classList.add('is-hidden');
    challengePaused = exitConfirmWasPaused;
    if (challengePaused) pauseOverlay.classList.remove('is-hidden');
  });
  document.getElementById('back-home').addEventListener('click', exitChallenge);
}

function exitChallenge() {
  advancedMode = false; challengePaused = false; cleanRoundOver = false; bubbles = []; particles = []; score = 0;
  document.getElementById('challenge-controls').classList.add('is-hidden');
  document.getElementById('score-display').classList.add('is-hidden');
  document.getElementById('pause-overlay').classList.add('is-hidden');
  document.getElementById('exit-confirm').classList.add('is-hidden');
  document.getElementById('round-summary').classList.add('is-hidden');
  document.getElementById('challenge-home-copy').classList.remove('is-hidden');
  document.getElementById('bubble-guide').classList.remove('is-hidden');
  scheduleHomeBubbles();
}
function openExitConfirm() {
  exitConfirmWasPaused = challengePaused;
  challengePaused = true;
  document.getElementById('exit-confirm').classList.remove('is-hidden');
  document.getElementById('pause-overlay').classList.add('is-hidden');
}

function startCleanRound() { if (homeSpawnTimer) clearTimeout(homeSpawnTimer); advancedMode = true; challengePaused = false; bubbles = []; particles = []; score = 0; cleanPage = 0; cleanNativeRemaining = 0; cleanRoundOver = false; cleanRoundEndsAt = millis() + 30000; document.getElementById('round-summary').classList.add('is-hidden'); document.getElementById('pause-overlay').classList.add('is-hidden'); document.getElementById('challenge-home-copy').classList.add('is-hidden'); document.getElementById('bubble-guide').classList.add('is-hidden'); document.getElementById('challenge-controls').classList.remove('is-hidden'); spawnCleanPage(); }
function spawnCleanPage() {
  if (!advancedMode || challengeMode !== 'clean' || cleanRoundOver || cleanPage >= cleanPageCount) return;
  cleanPage++;
  const types = ['normal','normal','normal','normal','normal','normal','normal','normal','normal','normal','short','short','short','split','split','split'];
  cleanNativeRemaining = types.length;
  types.forEach(type => bubbles.push(new Bubble(random(width * .12, width * .88), random(height * .2, height * .82), true, type)));
}
function endCleanRound() {
  if (cleanRoundOver) return;
  const previousBest = highScore;
  cleanRoundOver = true; score = min(score, cleanScoreCap); highScore = max(highScore, score);
  challengePaused = false; document.getElementById('challenge-controls').classList.add('is-hidden'); document.getElementById('challenge-home-copy').classList.add('is-hidden');
  document.getElementById('summary-kicker').textContent = score >= cleanScoreCap ? 'PERFECT!' : (score > previousBest ? 'NEW RECORD!' : "TIME'S UP!");
  document.getElementById('summary-title').textContent = `SCORE ${score} / ${cleanScoreCap}`;
  document.getElementById('summary-best').textContent = `BEST ${highScore}`;
  document.getElementById('round-summary').classList.remove('is-hidden');
}
function refreshPreview() { previewType = random(['normal', 'normal', 'normal', 'gold', 'ice', 'split']); const el = document.getElementById('preview-bubble'); const colors = { normal: 'rgba(244,167,185,.7)', gold: 'rgba(244,202,105,.8)', ice: 'rgba(147,211,236,.8)', split: 'rgba(139,215,184,.8)' }; el.style.background = colors[previewType]; }
function nextMergeType(type) { return { normal: 'gold', gold: 'ice', ice: 'split', split: 'rainbow' }[type] || 'rainbow'; }

function resolveBubbleCollision(a, b) {
  if (a.isPopped || b.isPopped) return;
  const dx = b.x - a.x, dy = b.y - a.y;
  const minDistance = a.r + b.r;
  const distance = max(0.001, sqrt(dx * dx + dy * dy));
  if (distance >= minDistance) return;
  if (advancedMode && challengeMode === 'merge' && a.special === b.special && ['normal', 'gold', 'ice', 'split'].includes(a.special)) {
    a.isPopped = true; a.fragmentSpawned = true; a.popScale = .01;
    b.isPopped = true; b.fragmentSpawned = true; b.popScale = .01;
    bubbles.push(new Bubble((a.x + b.x) / 2, (a.y + b.y) / 2, true, nextMergeType(a.special)));
    score += 3; return;
  }
  if (advancedMode && (a.special === 'ice' || b.special === 'ice')) { a.speedY *= .985; b.speedY *= .985; a.wind *= .985; b.wind *= .985; }
  const nx = dx / distance, ny = dy / distance;
  const overlap = (minDistance - distance) * .5;
  a.x -= nx * overlap; a.y -= ny * overlap;
  b.x += nx * overlap; b.y += ny * overlap;
  // Gentle separation only: damped, non-bouncy room-scale motion.
  const push = .018 * .85;
  a.wind -= nx * push; b.wind += nx * push;
  a.wind = constrain(a.wind, -.4, .4); b.wind = constrain(b.wind, -.4, .4);
  // Overlap adds a small amount of pressure. It takes sustained stacking to pop.
  const pressureGain = constrain((minDistance - distance) / minDistance, 0, 1) * .02;
  a.pressure += pressureGain; b.pressure += pressureGain;
  if (!(advancedMode && challengeMode === 'clean')) {
    if (a.pressure > 1.3 && random() < .025) a.pop(false);
    if (b.pressure > 1.3 && random() < .025) b.pop(false);
  }
}

class Bubble {
  constructor(x, y, forced = false, specialOverride = null) {
    this.x = x; this.y = y; this.baseX = x;
    this.r = random(minRadius, maxRadius);
    // Smaller bubbles drift a little faster; larger ones rise more slowly.
    this.speedY = map(this.r, minRadius, maxRadius, -.35, -.15) + random(-.025, .025);
    this.wind = random(-.3, .3);
    this.turbulence = random(-.05, .05);
    this.color = structuredClone(random(palette));
    this.alpha = random(166, 204); // 0.65–0.8 opacity
    this.isPopped = false;
    this.popScale = 1;
    this.popGlow = 1;
    this.fragmentSpawned = false;
    this.pressure = 0;
    this.life = 0;
    this.seed = random(1000);
    this.highlightX = random(-.46, -.22);
    this.highlightY = random(-.48, -.22);
    this.pageNative = forced;
    this.special = specialOverride || (advancedMode && !forced ? this.chooseSpecial() : 'normal');
    this.maxLife = Infinity;
    if (advancedMode) {
      const lifeRanges = { normal: [480, 840], short: [240, 420], split: [360, 600] };
      const range = lifeRanges[this.special] || lifeRanges.normal;
      this.maxLife = random(range[0], range[1]);
    }
    this.age = 0;
    this.baseRadius = this.r;
  }

  chooseSpecial() {
    const roll = random();
    if (roll < .05) return 'rainbow';
    if (roll < .15) return 'gold';
    if (roll < .30) return 'ice';
    if (roll < .45) return 'split';
    return 'normal';
  }

  update() {
    if (this.isPopped) {
      this.popScale *= .92; this.popGlow = max(1, this.popGlow * .94);
      return;
    }
    this.life += .012;
    this.age++;
    if (advancedMode && this.age >= this.maxLife) { this.natural = true; if (challengeMode === 'guard') score = max(0, score - 1); this.pop(false); return; }
    if (this.special === 'short') this.r = this.baseRadius;
    this.y += this.speedY;
    this.wind = constrain(this.wind + random(-.012, .012) + this.turbulence, -.3, .3);
    this.turbulence = constrain(this.turbulence + random(-.004, .004), -.05, .05);
    this.x += this.wind + sin(frameCount * .018 + this.seed) * .12;
    this.pressure *= .985;
    const boundaryDamping = .75;
    if (this.x < this.r) { this.x = this.r; this.wind = abs(this.wind) * boundaryDamping; }
    if (this.x > width - this.r) { this.x = width - this.r; this.wind = -abs(this.wind) * boundaryDamping; }
    if (this.y < this.r) { this.y = this.r; this.speedY = abs(this.speedY) * boundaryDamping; }
    if (this.y > height - this.r) { this.y = height - this.r; this.speedY = -abs(this.speedY) * boundaryDamping; }
  }

  draw() {
    const eventScale = advancedMode && activeEvent === 'pulse' ? 1 + sin(frameCount * .12) * .035 : 1;
    push(); translate(this.x, this.y); scale(this.popScale * eventScale);
    const [r, g, b] = this.color;
    const fade = this.isPopped ? this.popScale : 1;
    const glow = this.isPopped ? this.popGlow : 1;
    drawingContext.shadowBlur = this.isPopped ? 28 : 12;
    drawingContext.shadowColor = `rgba(${r},${g},${b},${.28 * fade})`;
    let drawColor = [r, g, b];
    if (this.special === 'short') drawColor = [246, 181, 135];
    if (this.special === 'split') drawColor = [139, 215, 184];
    let lifeFade = 1;
    if (advancedMode && this.maxLife !== Infinity && this.maxLife - this.age < 120) lifeFade = .8 + sin(frameCount * .18) * .2;
    fill(min(255, drawColor[0] * glow), min(255, drawColor[1] * glow), min(255, drawColor[2] * glow), this.alpha * fade * lifeFade); circle(0, 0, this.r * 2);
    drawingContext.shadowBlur = 0;
    noFill(); stroke(255, 255, 255, 55 * fade); strokeWeight(1); circle(0, 0, this.r * 2 - 1);
    noStroke(); fill(255, 255, 255, 220 * fade); circle(this.r * this.highlightX, this.r * this.highlightY, max(4, this.r * .22));
    fill(255, 255, 255, 135 * fade); circle(this.r * (this.highlightX + .17), this.r * (this.highlightY - .12), max(2, this.r * .09));
    if (advancedMode && this.special === 'short' && this.r * 2 >= 50) { noStroke(); fill(255, 232, 199, 180 * fade); circle(0, -this.r * .08, max(3, this.r * .1)); circle(this.r * .08, -this.r * .15, max(2, this.r * .06)); }
    if (advancedMode && this.special === 'split') { noStroke(); fill(235, 255, 245, 150 * fade); circle(-this.r * .18, 0, this.r * .17); circle(this.r * .18, 0, this.r * .17); }
    if (advancedMode && this.r * 2 >= 50) {
      push(); textAlign(CENTER, CENTER); textSize(this.r * (this.r * 2 > 80 ? .22 : .16)); fill(255, 255, 255, 175 * fade);
      if (this.special === 'short' && this.r * 2 > 50) text('•', 0, 1);
      if (this.special === 'split' && this.r * 2 > 50) text('◦ ◦', 0, 1);
      pop();
    }
    pop();
  }

  checkPop(mx, my, forgiving = false) { return dist(mx, my, this.x, this.y) < this.r * (forgiving ? 1.4 : 1); }
  pop(manual = false) {
    const burstParticleColor = structuredClone(this.color);
    if (this.isPopped) return;
    if (this.pageNative && advancedMode && challengeMode === 'clean') cleanNativeRemaining = max(0, cleanNativeRemaining - 1);
    this.isPopped = true; this.popScale = 1.15; this.popGlow = 1.2;
    if (advancedMode && manual) {
      if (challengeMode === 'clean') score = min(cleanScoreCap, score + (this.special === 'normal' ? 1 : 2));
      highScore = max(highScore, score);
    }
    this.spawnFragments(burstParticleColor);
    if (this.special === 'split' && manual && !this.natural) {
      // The child gets its own independent business color; it is not forced to blue.
      const targetChildColor = structuredClone(random(palette));
      const child = new Bubble(this.x + random(-8, 8), this.y + random(-8, 8), false, 'normal');
      child.color = structuredClone(targetChildColor);
      bubbles.push(child);
    }
  }
  spawnFragments(originalColor) {
    this.fragmentSpawned = true;
    for (let i = 0; i < floor(random(6, 9)); i++) particles.push(new BurstBubble(this.x, this.y, this.r, structuredClone(originalColor)));
  }
  isDead() { return this.isPopped && this.popScale < .06; }
}

class ChildBubble {
  constructor(x, y, parentRadius, color) {
    this.x = x; this.y = y; this.color = structuredClone(color);
    this.r = parentRadius * random(.25, .4); this.startR = this.r;
    const angle = random(TWO_PI), speed = random(2.2, 5.2);
    this.vx = cos(angle) * speed; this.vy = sin(angle) * speed;
    this.life = 0; this.maxLife = random(48, 72);
    this.highlightX = random(-.45, -.2); this.highlightY = random(-.48, -.22);
  }
  update() { this.life++; this.x += this.vx; this.y += this.vy; this.vx *= .975; this.vy = this.vy * .975 + .018; this.r = this.startR * max(0, 1 - this.life / this.maxLife); }
  draw() {
    const fade = max(0, 1 - this.life / this.maxLife);
    push(); translate(this.x, this.y); noStroke(); fill(this.color[0], this.color[1], this.color[2], 190 * fade); circle(0, 0, this.r * 2);
    noFill(); stroke(255, 255, 255, 125 * fade); strokeWeight(1); circle(0, 0, this.r * 2 - 1);
    noStroke(); fill(255, 255, 255, 220 * fade); circle(this.r * this.highlightX, this.r * this.highlightY, max(2, this.r * .25)); pop();
  }
  isDead() { return this.life >= this.maxLife || this.r <= .5; }
}

// Parent-burst fragments are a separate type so they can never inherit child colors.
class BurstBubble extends ChildBubble {
  constructor(x, y, parentRadius, burstColor) {
    super(x, y, parentRadius, structuredClone(burstColor));
    this.color = structuredClone(burstColor);
    this.startR *= random(.72, 1.08);
    this.r = this.startR;
    this.maxLife = random(36, 58);
  }
}

class CelebrationParticle extends ChildBubble {
  constructor(x, y, color) {
    super(x, y, 30, color); this.r = random(4, 9); this.startR = this.r;
    this.vx = random(-2.8, 2.8);
    this.vy = random(-2.8, 2.8);
    this.maxLife = random(52, 82);
  }
}

function mousePressed() {
  if (mouseButton !== LEFT) return false;
  if (isSettingPopupOpen) return false;
  prevMouseX = mouseX; prevMouseY = mouseY;
  if (advancedMode && challengeMode === 'clean') return false;
  const clickedBubble = bubbles.find(b => !b.isPopped && b.checkPop(mouseX, mouseY));
  if (clickedBubble) clickedBubble.pop(true);
  else {
    if (advancedMode && challengeMode === 'clean') { if (cleanRoundOver) startCleanRound(); return false; }
    const aliveCount = bubbles.filter(b => !b.isPopped).length;
    if (aliveCount >= maxBubbleCount) collectivePop();
    else {
      bubbles.push(new Bubble(mouseX, mouseY, false, advancedMode && challengeMode === 'merge' ? previewType : null));
      if (advancedMode && challengeMode === 'merge') refreshPreview();
      if (shouldCollectivePop()) collectivePop();
    }
  }
  return false;
}
function handleCanvasPointerDown(event) {
  if (!advancedMode || challengeMode !== 'clean' || isSettingPopupOpen || challengePaused) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  const rect = gameCanvas.elt.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (width / rect.width);
  const y = (event.clientY - rect.top) * (height / rect.height);
  console.debug('[Bubble Room] challenge mousedown', { x, y, pointerType: event.pointerType });
  handleChallengeTap(x, y);
  event.preventDefault();
}
function handleChallengeTap(x, y) {
  if (isSettingPopupOpen || challengePaused) return false;
  console.debug('[Bubble Room] challenge tap', { x, y });
  const clickedBubble = bubbles.find(b => !b.isPopped && b.checkPop(x, y, true));
  if (clickedBubble) clickedBubble.pop(true);
  else if (cleanRoundOver) startCleanRound();
  return false;
}
function mouseDragged() {
  if (mouseButton !== LEFT) return false;
  if (advancedMode && challengeMode === 'clean') return false;
  for (const bubble of bubbles) {
    if (!bubble.isPopped && segmentHitsBubble(prevMouseX, prevMouseY, mouseX, mouseY, bubble)) bubble.pop(true);
  }
  prevMouseX = mouseX; prevMouseY = mouseY;
  return false;
}
function touchStarted() {
  if (isSettingPopupOpen) return false;
  if (advancedMode && challengeMode === 'clean') return false;
  return false;
}
function segmentHitsBubble(x1, y1, x2, y2, bubble) {
  const dx = x2 - x1, dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return bubble.checkPop(x2, y2);
  const t = constrain(((bubble.x - x1) * dx + (bubble.y - y1) * dy) / lengthSq, 0, 1);
  const closestX = x1 + t * dx, closestY = y1 + t * dy;
  return dist(closestX, closestY, bubble.x, bubble.y) < bubble.r;
}
function keyPressed() {
  if (key === ' ') {
    collectivePop();
    return false;
  }
}
function collectivePop() {
  let didPop = false;
  bubbles.forEach(b => { if (!b.isPopped) { b.pop(false); didPop = true; } });
  if (advancedMode && challengeMode === 'clean') score = 0;
  if (!didPop) return;
  if (advancedMode && challengeMode === 'clean') endCleanRound();
  // Wide celebration particles are reserved for collective events only.
  for (let i = 0; i < 42; i++) {
    particles.push(new CelebrationParticle(random(width), random(height), random(palette)));
  }
}
function windowResized() { resizeCanvas(windowWidth, windowHeight); recalculateBubbleRadius(); }
