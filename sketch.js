let bubbles = [];
let particles = [];
let stars = [];
const maxBubbleCount = 22;
const areaBurstThreshold = .68;
let minRadius = 90;
let maxRadius = 160;
let prevMouseX = 0;
let prevMouseY = 0;

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
  canvas.parent('canvas-wrap');
  pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
  noStroke();
  recalculateBubbleRadius();
  for (let i = 0; i < 90; i++) stars.push({ x: random(width), y: random(height), r: random(.3, 1.4), a: random(18, 70) });
}

function draw() {
  // Opaque clear every frame: bubbles never leave motion trails.
  background(248, 247, 239);
  drawAmbient();

  for (let i = 0; i < bubbles.length; i++) {
    for (let j = i + 1; j < bubbles.length; j++) resolveBubbleCollision(bubbles[i], bubbles[j]);
  }

  for (let i = bubbles.length - 1; i >= 0; i--) {
    const bubble = bubbles[i];
    bubble.update();
    bubble.draw();
    if (bubble.isDead()) bubbles.splice(i, 1);
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update(); particles[i].draw();
    if (particles[i].isDead()) particles.splice(i, 1);
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
  minRadius = shortSide * (mobile ? .085 : .13);
  maxRadius = shortSide * (mobile ? .16 : .23);
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

function resolveBubbleCollision(a, b) {
  if (a.isPopped || b.isPopped) return;
  const dx = b.x - a.x, dy = b.y - a.y;
  const minDistance = a.r + b.r;
  const distance = max(0.001, sqrt(dx * dx + dy * dy));
  if (distance >= minDistance) return;
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
  if (a.pressure > 1.3 && random() < .025) a.pop();
  if (b.pressure > 1.3 && random() < .025) b.pop();
}

class Bubble {
  constructor(x, y) {
    this.x = x; this.y = y; this.baseX = x;
    this.r = random(minRadius, maxRadius);
    // Smaller bubbles drift a little faster; larger ones rise more slowly.
    this.speedY = map(this.r, minRadius, maxRadius, -.35, -.15) + random(-.025, .025);
    this.wind = random(-.3, .3);
    this.turbulence = random(-.05, .05);
    this.color = random(palette);
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
  }

  update() {
    if (this.isPopped) {
      this.popScale *= .92; this.popGlow = max(1, this.popGlow * .94);
      if (!this.fragmentSpawned && this.popScale < 1.1) this.spawnFragments();
      return;
    }
    this.life += .012;
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
    push(); translate(this.x, this.y); scale(this.popScale);
    const [r, g, b] = this.color;
    const fade = this.isPopped ? this.popScale : 1;
    const glow = this.isPopped ? this.popGlow : 1;
    drawingContext.shadowBlur = this.isPopped ? 28 : 12;
    drawingContext.shadowColor = `rgba(${r},${g},${b},${.28 * fade})`;
    fill(min(255, r * glow), min(255, g * glow), min(255, b * glow), this.alpha * fade); circle(0, 0, this.r * 2);
    drawingContext.shadowBlur = 0;
    noFill(); stroke(255, 255, 255, 55 * fade); strokeWeight(1); circle(0, 0, this.r * 2 - 1);
    noStroke(); fill(255, 255, 255, 220 * fade); circle(this.r * this.highlightX, this.r * this.highlightY, max(4, this.r * .22));
    fill(255, 255, 255, 135 * fade); circle(this.r * (this.highlightX + .17), this.r * (this.highlightY - .12), max(2, this.r * .09));
    pop();
  }

  checkPop(mx, my) { return dist(mx, my, this.x, this.y) < this.r; }
  pop() {
    if (this.isPopped) return;
    this.isPopped = true; this.popScale = 1.15; this.popGlow = 1.2;
  }
  spawnFragments() {
    this.fragmentSpawned = true;
    for (let i = 0; i < floor(random(6, 9)); i++) particles.push(new ChildBubble(this.x, this.y, this.r, this.color));
  }
  isDead() { return this.isPopped && this.popScale < .06; }
}

class ChildBubble {
  constructor(x, y, parentRadius, color) {
    this.x = x; this.y = y; this.color = color;
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
  prevMouseX = mouseX; prevMouseY = mouseY;
  const clickedBubble = bubbles.find(b => !b.isPopped && b.checkPop(mouseX, mouseY));
  if (clickedBubble) clickedBubble.pop();
  else {
    const aliveCount = bubbles.filter(b => !b.isPopped).length;
    if (aliveCount >= maxBubbleCount) collectivePop();
    else {
      bubbles.push(new Bubble(mouseX, mouseY));
      if (shouldCollectivePop()) collectivePop();
    }
  }
  return false;
}
function mouseDragged() {
  if (mouseButton !== LEFT) return false;
  for (const bubble of bubbles) {
    if (!bubble.isPopped && segmentHitsBubble(prevMouseX, prevMouseY, mouseX, mouseY, bubble)) bubble.pop();
  }
  prevMouseX = mouseX; prevMouseY = mouseY;
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
  bubbles.forEach(b => { if (!b.isPopped) { b.pop(); didPop = true; } });
  if (!didPop) return;
  // Wide celebration particles are reserved for collective events only.
  for (let i = 0; i < 42; i++) {
    particles.push(new CelebrationParticle(random(width), random(height), random(palette)));
  }
}
function windowResized() { resizeCanvas(windowWidth, windowHeight); recalculateBubbleRadius(); }
