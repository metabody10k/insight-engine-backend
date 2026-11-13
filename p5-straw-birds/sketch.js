// Straw Birds — 빨대로 만들어진 새들이 흩어지는 장면 (p5.js)
// 클릭: 새로운 배치 생성 / S 키: PNG 저장

const W = 768, H = 1376;          // 원본 이미지 비율 기준 좌표계
let k = 1;                        // 화면 스케일
let birds = [], particles = [], bg;
let seed = 7;

const COL = {
  blue:   [44, 112, 214],
  sky:    [88, 168, 242],
  orange: [244, 102, 40],
  pink:   [238, 62, 150],
  cream:  [246, 216, 186],
};
const STRIPE_PINK = [236, 84, 150];
const STRIPE_BLUE = [70, 136, 226];

function randColor() {
  const r = random();
  if (r < 0.30) return { c: COL.blue };
  if (r < 0.48) return { c: COL.orange };
  if (r < 0.60) return { c: COL.cream, s: STRIPE_PINK };
  if (r < 0.69) return { c: COL.cream, s: STRIPE_BLUE };
  if (r < 0.80) return { c: COL.pink };
  if (r < 0.92) return { c: COL.sky };
  return { c: COL.cream };
}

// ───────────────────────── 빨대 렌더링 ─────────────────────────
function drawStraw(p, w, c, s, br, so, capStart, R = window) {
  const h = w * 0.5, n = p.length >> 1;
  for (let i = 0; i < n - 1; i++) {
    const x1 = p[2 * i], y1 = p[2 * i + 1], x2 = p[2 * i + 2], y2 = p[2 * i + 3];
    const L = Math.hypot(x2 - x1, y2 - y1);
    R.push();
    R.translate(x1, y1);
    R.rotate(Math.atan2(y2 - y1, x2 - x1));
    const x0 = i > 0 ? -h * 0.9 : 0;
    const len = L - x0;
    // 분리감을 주는 얇은 그림자 테두리
    R.fill(0, 0, 0, 130);
    R.rect(x0, -h - 0.9, len, w + 1.8);
    // 본체
    R.fill(c[0] * br, c[1] * br, c[2] * br);
    R.rect(x0, -h, len, w);
    // 사선 줄무늬
    if (s) {
      R.fill(s[0] * br, s[1] * br, s[2] * br);
      const sp = w * 1.5, sw = w * 0.42;
      for (let x = x0 + (so * sp) % sp + h; x < L - sw - h; x += sp)
        R.quad(x, -h, x + sw, -h, x + sw - h * 0.9, h, x - h * 0.9, h);
    }
    // 원통 음영 + 하이라이트
    R.fill(0, 0, 0, 90);  R.rect(x0, h * 0.15, len, h * 0.85);
    R.fill(0, 0, 0, 70);  R.rect(x0, h * 0.62, len, h * 0.38);
    R.fill(255, 255, 255, 95); R.rect(x0, -h * 0.72, len, h * 0.3);
    R.fill(255, 255, 255, 45); R.rect(x0, -h * 0.9, len, h * 0.6);
    // 주름(벤딩 빨대) 부분
    if (i > 0) {
      for (let j = -1; j <= 3; j++) {
        R.fill(0, 0, 0, 85);
        R.rect(j * w * 0.26 - 0.5, -h, Math.max(1, w * 0.1), w);
        R.fill(255, 255, 255, 60);
        R.rect(j * w * 0.26 + w * 0.1, -h, Math.max(0.8, w * 0.07), w);
      }
    }
    if (i === 0 && capStart) cap(0, h, c, br, -1, R);
    if (i === n - 2) cap(L, h, c, br, 1, R);
    R.pop();
  }
}

function cap(x, h, c, br, d, R) {
  R.fill(min(255, c[0] * br * 1.05 + 40), min(255, c[1] * br * 1.05 + 40), min(255, c[2] * br * 1.05 + 40));
  R.ellipse(x, 0, h * 0.95, h * 2);
  R.fill(c[0] * 0.28 * br, c[1] * 0.28 * br, c[2] * 0.28 * br);
  R.ellipse(x + d * h * 0.07, 0, h * 0.6, h * 1.5);
}

// ───────────────────────── 새 생성 ─────────────────────────
function feather(rx, ry, a, L, bendP, bendDir) {
  if (random() < bendP) {
    const a0 = a + bendDir * random(0.25, 0.55), l0 = L * random(0.2, 0.35);
    const mx = rx + cos(a0) * l0, my = ry + sin(a0) * l0;
    return [rx, ry, mx, my, mx + cos(a) * (L - l0), my + sin(a) * (L - l0)];
  }
  return [rx, ry, rx + cos(a) * L, ry + sin(a) * L];
}

function genBird(o) {
  const S = [];
  const d = o.density;
  const add = (pts, w, g, col, br) => {
    if (random() > o.keep) return;
    col = col || randColor();
    S.push({ pts, w: w * o.thick, g, c: col.c, s: col.s,
             br: br === undefined ? random(0.78, 1.08) : br, so: random(10) });
  };

  // 1) 뒤쪽 날개
  const far = [];
  for (let i = 0; i < 70 * d; i++) {
    const u = random();
    const rx = lerp(-95, 15, u) + random(-10, 10), ry = lerp(-125, -105, u) + random(-10, 10);
    const a = radians(lerp(-122, -78, u) + random(-6, 6) + o.lift);
    const L = lerp(130, 250, u) * random(0.7, 1.05) * o.farLen;
    far.push({ u, pts: feather(rx, ry, a, L, 0.35, 1) });
  }
  far.sort((p, q) => p.u - q.u).forEach(f => add(f.pts, random(10, 13), 'far', null, random(0.55, 0.8)));

  // 2) 꼬리
  for (let i = 0; i < 70 * d; i++) {
    const u = random();
    const rx = lerp(130, 200, u) + random(-12, 12), ry = lerp(100, 170, u) + random(-12, 12);
    const a = radians(lerp(30, 66, random()) );
    add(feather(rx, ry, a, random(190, 320) * o.tailLen, 0.15, -1), random(11, 14), 'tail');
  }

  // 3) 몸통 (꼬리 → 머리 순서로 겹치기)
  const Hd = [-200, -108], M = [-20, -40], T = [180, 150];
  const P = t => [
    (1 - t) * (1 - t) * Hd[0] + 2 * t * (1 - t) * M[0] + t * t * T[0],
    (1 - t) * (1 - t) * Hd[1] + 2 * t * (1 - t) * M[1] + t * t * T[1]];
  const D = t => {
    const x = 2 * (1 - t) * (M[0] - Hd[0]) + 2 * t * (T[0] - M[0]);
    const y = 2 * (1 - t) * (M[1] - Hd[1]) + 2 * t * (T[1] - M[1]);
    const m = Math.hypot(x, y); return [x / m, y / m];
  };
  const R = t => 40 + 60 * sin(PI * pow(t, 0.75));
  const body = [];
  for (let i = 0; i < 320 * d; i++) {
    const t = random(0.06, 1), v = random(-1, 1);
    const [px, py] = P(t), [dx, dy] = D(t);
    const r = R(t) * 0.95;
    const x = px - dy * v * r, y = py + dx * v * r;
    const a = Math.atan2(dy, dx) - v * 0.28 + random(-0.1, 0.1);
    const L = random(45, 95) * (0.7 + t * 0.8);
    body.push({ t, pts: [x - cos(a) * L * 0.35, y - sin(a) * L * 0.35, x + cos(a) * L * 0.65, y + sin(a) * L * 0.65] });
  }
  body.sort((p, q) => q.t - p.t).forEach(b => add(b.pts, random(9, 12), 'body'));

  // 4) 다리
  const legC = { c: COL.orange };
  for (const ox of [0, 34]) {
    add([70 + ox, 150, 95 + ox, 215, 84 + ox, 246], 10, 'leg', legC, 0.95);
    add([95 + ox, 215, 120 + ox, 238, 130 + ox, 262], 7, 'leg', legC, 1.0);
    add([95 + ox, 215, 104 + ox, 250, 93 + ox, 270], 7, 'leg', legC, 0.9);
  }

  // 5) 머리
  const head = [];
  for (let i = 0; i < 80 * d; i++) {
    const t = random(0, 0.16), v = random(-1, 1);
    const [px, py] = P(t), [dx, dy] = D(t);
    const r = R(t) * 0.9;
    const x = px - dy * v * r, y = py + dx * v * r;
    const a = Math.atan2(dy, dx) - v * 0.35 + random(-0.12, 0.12);
    const L = random(22, 48);
    head.push({ t, pts: [x - cos(a) * L * 0.3, y - sin(a) * L * 0.3, x + cos(a) * L * 0.7, y + sin(a) * L * 0.7] });
  }
  head.sort((p, q) => q.t - p.t).forEach(b => add(b.pts, random(7.5, 9.5), 'head',
    random() < 0.5 ? { c: COL.blue } : (random() < 0.5 ? { c: COL.orange } : randColor())));

  // 6) 앞쪽 날개 — 긴 깃털
  const near = [];
  for (let i = 0; i < 150 * d; i++) {
    const u = random();
    const rx = lerp(20, 150, u) + random(-14, 14), ry = lerp(-20, -200, u) + random(-14, 14);
    const a = radians(lerp(20, -48, u) + random(-6, 6) + o.lift * 0.6);
    const L = lerp(220, 520, pow(u, 0.8)) * random(0.7, 1.05) * o.nearLen;
    near.push({ u, pts: feather(rx, ry, a, L, 0.3, 1) });
  }
  near.sort((p, q) => p.u - q.u).forEach(f => add(f.pts, random(12, 16), 'near'));

  // 7) 덮깃(짧은 깃털)
  const cov = [];
  for (let i = 0; i < 90 * d; i++) {
    const u = random();
    const rx = lerp(0, 120, u) + random(-14, 14), ry = lerp(-10, -180, u) + random(-14, 14);
    const a = radians(lerp(25, -40, u) + random(-8, 8) + o.lift * 0.6);
    const L = random(70, 150) * o.nearLen;
    cov.push({ u, pts: feather(rx, ry, a, L, 0.2, 1) });
  }
  cov.sort((p, q) => p.u - q.u).forEach(f => add(f.pts, random(11, 14), 'near'));

  // 8) 날개 앞전 — 꺾인 빨대
  const edgeCols = [{ c: COL.orange }, { c: COL.blue }, { c: COL.orange }, { c: COL.cream, s: STRIPE_PINK }, { c: COL.blue }];
  const lift = radians(o.lift * 0.6);
  for (let j = 0; j < 5; j++) {
    const off = j * 12;
    const Ax = 0 + off * 0.87, Ay = -30 + off * 0.5;
    const Bx = 115 + off * 0.7, By = -235 + off * 0.7;
    const l2 = 460 * o.nearLen - j * 25, a2 = -PI / 4 + lift;
    add([Ax, Ay, Bx, By, Bx + cos(a2) * l2, By + sin(a2) * l2], 15, 'near', edgeCols[j], j === 0 ? 1.08 : 0.95);
  }

  // 흩어짐 (작은 새들이 부서지는 효과)
  if (o.scatter > 0) {
    for (const st of S) {
      const x = st.pts[0], y = st.pts[1];
      const p = constrain((x + 40) / 260, 0, 1) * o.scatter;
      if (random() < p) {
        const dx = random(40, 260) * p, dy = random(-40, 160) * p, rr = random(-1.2, 1.2);
        const cx = st.pts[0], cy = st.pts[1];
        const keepLen = random(0.3, 0.7);
        const nx = cx + (st.pts[2] - cx) * keepLen, ny = cy + (st.pts[3] - cy) * keepLen;
        const rot = (px, py) => [cx + (px - cx) * cos(rr) - (py - cy) * sin(rr) + dx,
                                 cy + (px - cx) * sin(rr) + (py - cy) * cos(rr) + dy];
        st.pts = [...rot(cx, cy), ...rot(nx, ny)];
        st.g = 'loose';
        st.capStart = true;
      }
    }
  }
  return S;
}

// 데코: 부리와 눈
function drawBeakEye(R) {
  R.fill(220, 120, 50);
  R.triangle(-287, -112, -208, -132, -200, -98);
  R.fill(250, 168, 92);
  R.triangle(-287, -112, -208, -132, -205, -114);
  R.fill(255, 210, 150, 160);
  R.triangle(-280, -113, -215, -128, -214, -121);
  R.fill(10);
  R.ellipse(-168, -124, 15, 14);
  R.fill(255, 255, 255, 200);
  R.ellipse(-171, -127, 4.5, 4);
}

// 새를 세 개의 레이어(뒤 날개 / 몸통 / 앞 날개)로 미리 렌더링해 두고,
// 매 프레임에는 날개 레이어만 회전시켜 날갯짓을 표현한다.
const PIVOT = { near: [40, -60], far: [-40, -115] };

function bakeLayer(b, straws, withBeak) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const st of straws)
    for (let i = 0; i < st.pts.length; i += 2) {
      x0 = Math.min(x0, st.pts[i]); x1 = Math.max(x1, st.pts[i]);
      y0 = Math.min(y0, st.pts[i + 1]); y1 = Math.max(y1, st.pts[i + 1]);
    }
  if (withBeak) { x0 = Math.min(x0, -300); y0 = Math.min(y0, -150); }
  const m = 22;
  x0 -= m; y0 -= m; x1 += m; y1 += m;
  const s = b.sc * k;
  const g = createGraphics(Math.max(1, Math.ceil((x1 - x0) * s)), Math.max(1, Math.ceil((y1 - y0) * s)));
  g.pixelDensity(pd());
  g.noStroke();
  g.scale(s);
  g.translate(-x0, -y0);
  for (const st of straws) {
    drawStraw(st.pts, st.w, st.c, st.s, st.br * b.light, st.so, st.capStart, g);
  }
  if (withBeak) drawBeakEye(g);
  return { g, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function bakeBird(b) {
  for (const L of Object.values(b.layers || {})) L.g.remove();
  const by = g => b.straws.filter(st => (st.g === 'near' || st.g === 'far' ? st.g : 'body') === g);
  b.layers = { far: bakeLayer(b, by('far')), body: bakeLayer(b, by('body'), true), near: bakeLayer(b, by('near')) };
}

function drawLayer(L, piv, a) {
  push();
  if (piv) { translate(piv[0], piv[1]); rotate(a); translate(-piv[0], -piv[1]); }
  image(L.g, L.x, L.y, L.w, L.h);
  pop();
}

function drawBird(b, t) {
  const ph = t * b.speed + b.phase;
  const flap = b.amp * Math.sin(ph);
  push();
  translate(b.x, b.y + Math.sin(ph + 1.2) * 6 * b.sc);
  scale(b.sc * b.dir, b.sc);
  rotate(b.tilt);
  drawLayer(b.layers.far, PIVOT.far, -flap * 0.8);
  drawLayer(b.layers.body);
  drawLayer(b.layers.near, PIVOT.near, flap);
  pop();
}

// 새의 로컬 좌표 → 월드 좌표
function birdToWorld(b, lx, ly) {
  const c = Math.cos(b.tilt), s = Math.sin(b.tilt);
  const x = lx * c - ly * s, y = lx * s + ly * c;
  return [b.x + x * b.sc * b.dir, b.y + y * b.sc];
}

// ───────────────────────── 파편 ─────────────────────────
function makeFrag(sz) {
  const col = randColor();
  const len = random(6, 30) * sz, w = random(3.5, 6.5) * sz;
  const bent = random() < 0.25;
  const b = random(0.4, 1.0) * (random() < 0.5 ? -1 : 1);
  const pts = bent
    ? [-len / 2, 0, 0, 0, cos(b) * len / 2, sin(b) * len / 2]
    : [-len / 2, 0, len / 2, 0];
  return { pts, w, c: col.c, s: col.s, so: random(10), br: random(0.75, 1.1),
           a: random(TWO_PI), va: random(-0.03, 0.03) };
}

function ambient(x, y, sz, depth) {
  const p = makeFrag(sz);
  Object.assign(p, { x, y, vx: random(0.05, 0.35), vy: random(-0.1, 0.25), type: 'amb', depth, life: 1 });
  return p;
}

function streamFrom(p) {
  // 작은 새 또는 큰 새의 날개/꼬리 끝에서 떨어져 나오는 파편
  const src = random() < 0.75 ? random(birds.slice(1)) : birds[0];
  let lx, ly;
  if (src === birds[0]) { lx = random(250, 480); ly = random(-450, 330); }
  else { lx = random(40, 330); ly = random(-260, 260); }
  const [x, y] = birdToWorld(src, lx, ly);
  const f = makeFrag(src === birds[0] ? random(0.8, 1.5) : random(0.6, 1.1));
  Object.assign(p, f, {
    x, y, type: 'str', depth: random() < 0.5 ? 0 : 1,
    vx: src.dir * random(0.25, 1.2), vy: random(-0.3, 0.9),
    age: 0, maxAge: random(220, 600), life: 0,
  });
  return p;
}

function initParticles() {
  particles = [];
  // 작은 새 주변의 파편 구름
  for (let i = 0; i < 230; i++)
    particles.push(ambient(300 + randomGaussian() * 110, 1050 + randomGaussian() * 95, random(0.7, 1.2), random() < 0.5 ? 0 : 1));
  // 큰 새 날개/꼬리 주변
  for (let i = 0; i < 110; i++)
    particles.push(ambient(random(430, 790), random(80, 1100), random(0.8, 1.5), random() < 0.5 ? 0 : 1));
  // 전체에 흩뿌려진 파편
  for (let i = 0; i < 50; i++)
    particles.push(ambient(random(W), random(H), random(0.6, 1.2), 0));
  // 화면 아래 왼쪽, 카메라 가까이 있는 큰 파편
  for (let i = 0; i < 34; i++)
    particles.push(ambient(random(-20, 380), random(1120, 1390), random(2.0, 3.6), 1));
  // 계속 흘러나오는 파편
  for (let i = 0; i < 120; i++) {
    const p = streamFrom({});
    p.age = random(p.maxAge);
    p.x += p.vx * p.age; p.y += p.vy * p.age;
    particles.push(p);
  }
}

function updateDrawParticles(depth, t) {
  for (const p of particles) {
    if (p.depth !== depth) continue;
    p.x += p.vx + (noise(p.x * 0.004, p.y * 0.004, t * 0.2) - 0.5) * 0.6;
    p.y += p.vy + (noise(p.y * 0.004, p.x * 0.004, t * 0.2 + 9) - 0.5) * 0.6;
    p.a += p.va;
    let s = 1;
    if (p.type === 'str') {
      p.age++;
      s = Math.min(1, p.age / 25, (p.maxAge - p.age) / 40);
      if (p.age > p.maxAge) { streamFrom(p); continue; }
    } else {
      if (p.x > W + 60) p.x = -60;
      if (p.y > H + 60) p.y = -60;
      if (p.y < -60) p.y = H + 60;
    }
    if (s <= 0) continue;
    push();
    translate(p.x, p.y);
    rotate(p.a);
    scale(s);
    drawStraw(p.pts, p.w, p.c, p.s, p.br, p.so, true);
    pop();
  }
}

// ───────────────────────── 배경 ─────────────────────────
function makeBg() {
  bg = createGraphics(W, H);
  bg.pixelDensity(1);
  const g = bg.drawingContext;
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  let rg = g.createRadialGradient(420, 520, 20, 420, 520, 620);
  rg.addColorStop(0, 'rgba(40,30,60,0.55)');
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.fillRect(0, 0, W, H);
  rg = g.createRadialGradient(300, 1050, 10, 300, 1050, 380);
  rg.addColorStop(0, 'rgba(30,25,50,0.4)');
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.fillRect(0, 0, W, H);
}

// ───────────────────────── 셋업 ─────────────────────────
function build() {
  randomSeed(seed);
  noiseSeed(seed);
  const base = { density: 1, keep: 1, thick: 1, lift: 0, farLen: 1, nearLen: 1, tailLen: 1, scatter: 0 };
  const small = { density: 0.8, keep: 0.97, thick: 1.15, lift: -18, farLen: 1.1, nearLen: 0.75, tailLen: 0.8 };
  birds = [
    { x: 330, y: 600, sc: 1, dir: 1, tilt: 0, speed: 1.6, phase: 0, amp: 0.1, light: 1,
      straws: genBird({ ...base }) },
    { x: 165, y: 862, sc: 0.31, dir: 1, tilt: 0.05, speed: 2.4, phase: 1.3, amp: 0.18, light: 0.92,
      straws: genBird({ ...small, scatter: 0.4 }) },
    { x: 452, y: 1035, sc: 0.33, dir: -1, tilt: 0.12, speed: 2.2, phase: 2.6, amp: 0.18, light: 0.92,
      straws: genBird({ ...small, scatter: 0.38 }) },
    { x: 190, y: 1192, sc: 0.27, dir: 1, tilt: -0.05, speed: 2.6, phase: 4.1, amp: 0.2, light: 0.85,
      straws: genBird({ ...small, scatter: 0.5 }) },
  ];
  birds.forEach(bakeBird);
  initParticles();
}

const pd = () => Math.min(2, displayDensity());

function fitCanvas() {
  const cw = Math.min(windowWidth, windowHeight * W / H);
  k = cw / W;
  return [Math.floor(cw), Math.floor(cw * H / W)];
}

function setup() {
  const [cw, ch] = fitCanvas();
  createCanvas(cw, ch);
  pixelDensity(pd());
  frameRate(30);
  noStroke();
  makeBg();
  build();
}

function windowResized() {
  const [cw, ch] = fitCanvas();
  resizeCanvas(cw, ch);
  birds.forEach(bakeBird);
}

function draw() {
  const t = millis() / 1000;
  push();
  scale(k);
  image(bg, 0, 0);
  updateDrawParticles(0, t);           // 뒤쪽 파편
  for (let i = birds.length - 1; i >= 0; i--) drawBird(birds[i], t);
  updateDrawParticles(1, t);           // 앞쪽 파편
  pop();
}

function mousePressed() {
  seed = Math.floor(Math.random() * 1e6);
  build();
}

function keyPressed() {
  if (key === 's' || key === 'S') saveCanvas('straw-birds', 'png');
}
