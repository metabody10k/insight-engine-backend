// Straw Terrain — 컬러 빨대 수만 개를 세워 만든 지형 (p5.js)
// 클릭/터치: 새로운 지형 생성 / S 키: PNG 저장
//
// 구조: 높이 지도(N x M) → 햇빛 그림자·법선 계산 → 원근 투영 → 먼 곳부터 기둥을 하나씩 그린다.
// 그리기는 매 프레임 시간 예산만큼 이어서 진행하므로, 지형이 뒤쪽부터 쌓여 올라온다.

const W = 768, H = 1376;                 // 원본 이미지 비율의 좌표계
const N = 250, M = 300;                  // 가로 기둥 수, 깊이 기둥 수
const F = 1150, CAM_Y = 150, CAM_Z = -2.9, VS = 1.6;   // VS: 세로 과장
const PITCH = 58 * Math.PI / 180, SP = Math.sin(PITCH), CP = Math.cos(PITCH);

let k = 1, pd = 1, seed = 11, ctx;
let ht, kind, dnA, lowA, mA, shA, dfA, aoA, cr, cg, cb;
let rowNext = 0, finished = false;
let PX = 0, PY = 0, PS = 0;              // proj() 결과

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
function hash(i, j, s = 0) {
  const v = Math.sin(i * 127.1 + j * 311.7 + s * 74.7 + seed * 17.3) * 43758.5453;
  return v - Math.floor(v);
}
function fbm(x, y) {
  return noise(x, y) * 0.5 + noise(x * 2 + 5.2, y * 2 + 1.3) * 0.3 + noise(x * 4 + 2.7, y * 4 + 8.1) * 0.2;
}
function rgb(r, g, b) {
  return 'rgb(' + (r < 0 ? 0 : r > 255 ? 255 : r | 0) + ',' + (g < 0 ? 0 : g > 255 ? 255 : g | 0) + ',' + (b < 0 ? 0 : b > 255 ? 255 : b | 0) + ')';
}

// 월드(x: 좌우, y: 높이, z: 카메라로부터의 거리) → 화면
function proj(x, y, z) {
  const dy = y * VS - CAM_Y, dz = z - CAM_Z;
  let depth = -dy * SP + dz * CP;
  if (depth < 1) depth = 1;
  const up = dy * CP + dz * SP;
  PS = F / depth;
  PX = W / 2 + x * PS;
  PY = H / 2 - up * PS;
}

// ───────────────────────── 지형 생성 ─────────────────────────
function gen() {
  randomSeed(seed); noiseSeed(seed);
  const n = N * M;
  ht = new Float32Array(n); kind = new Uint8Array(n); dnA = new Float32Array(n);
  lowA = new Float32Array(n); mA = new Float32Array(n);
  shA = new Uint8Array(n); dfA = new Float32Array(n); aoA = new Float32Array(n);
  cr = new Float32Array(n); cg = new Float32Array(n); cb = new Float32Array(n);
  const ph1 = random(TWO_PI), ph2 = random(TWO_PI);

  for (let j = 0; j < M; j++) {              // j = 0 이 가장 먼 줄
    const t = j / M;
    const xc = 50 - 74 * t + 18 * Math.sin(j * 0.05 + ph1) + 8 * Math.sin(j * 0.13 + ph2);   // 강 중심선
    const w = 9 + 4 * Math.sin(j * 0.03 + 2) + 5 * (1 - t) + 2 * noise(j * 0.05, 3);          // 강 반폭
    const nearK = 1 - 0.6 * sm(0.5, 0.95, t);                                                // 카메라 앞 산은 낮게
    for (let i = 0; i < N; i++) {
      const idx = j * N + i, x = i - N / 2 + 0.5;
      const d = Math.abs(x - xc), e = d - w;
      let h = 0, ty = 0;
      if (d < w) {                                    // 강: 가운데가 가장 낮고 둑이 단계적으로 올라감
        ty = 1;
        const dn = d / w; dnA[idx] = dn;
        h = dn < 0.45 ? 0 : dn < 0.75 ? 1 : 2.5;
      } else {
        // 계단식 초원
        const low = Math.floor((3 + Math.min(e, 50) * 0.42 + 8 * fbm(x * 0.03, j * 0.03)) / 3.2) * 3.2;
        // 뾰족한 산
        let rn = 1 - Math.abs(2 * noise(x * 0.03, j * 0.02) - 1); rn *= rn;
        const det = fbm(x * 0.07 + 20, j * 0.07 + 20);
        const mk = sm(0.46, 0.64, noise(x * 0.011 + 9, j * 0.011 + 3) + e * 0.003);
        let ma = mk * (0.15 + 0.85 * (rn * 0.8 + det * 0.5)) * 70 * sm(8, 36, e) * nearK;
        if (ma > 2) ma += hash(i, j, 1) * 1.2;       // 기둥마다 들쭉날쭉
        lowA[idx] = low; mA[idx] = ma; h = low + ma;
      }
      // 가장자리의 평평한 판
      if (x < -(95 - j * 0.25) && j < 150) { ty = 3; h = 2 + hash(i, j, 2) * 0.4; mA[idx] = 0; }
      if (j < 10) { ty = 2; h = 1; mA[idx] = 0; }
      if (x > 72 && j < 26) { ty = 2; h = 6; mA[idx] = 0; }
      ht[idx] = h; kind[idx] = ty;
    }
  }

  // 그림자 · 법선 · 색
  let maxH = 0;
  for (let q = 0; q < n; q++) if (ht[q] > maxH) maxH = ht[q];
  const hx = 0.927, hj = -0.374, slope = 0.9;       // 햇빛: 오른쪽 위, 약간 뒤쪽에서
  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      const idx = j * N + i, h0 = ht[idx], x = i - N / 2 + 0.5;
      let sh = 0;
      for (let s = 1; s <= 90; s++) {
        const ci = Math.round(i + hx * s), cj = Math.round(j + hj * s);
        if (ci < 0 || ci >= N || cj < 0) break;
        if (h0 + s * slope > maxH) break;
        if (ht[cj * N + ci] > h0 + s * slope) { sh = 1; break; }
      }
      const iL = i > 0 ? idx - 1 : idx, iR = i < N - 1 ? idx + 1 : idx;
      const jF = j < M - 1 ? idx + N : idx, jB = j > 0 ? idx - N : idx;
      const gx = (ht[iR] - ht[iL]) * 0.5, gj = (ht[jF] - ht[jB]) * 0.5;
      const nx = -gx * 0.9, nj = -gj * 0.9, inv = 1 / Math.sqrt(nx * nx + 1 + nj * nj);
      const dot = (nx * 0.690 + 0.668 - nj * 0.278) * inv;
      dfA[idx] = Math.min(1.7, Math.max(0, dot / 0.668));
      shA[idx] = sh;
      const avg = (ht[iL] + ht[iR] + ht[jF] + ht[jB]) * 0.25;
      aoA[idx] = Math.min(1, Math.max(0.55, 1 - (avg - h0) * 0.02));

      let r, g, b;
      const ty = kind[idx], nn = hash(i, j, 3);
      if (ty === 1) {                                 // 강: 군청 → 파랑 → 청록
        const dn = dnA[idx];
        if (dn < 0.45) { r = 24 + 10 * nn; g = 48 + 22 * nn; b = 200 + 20 * nn; }
        else if (dn < 0.75) { r = 20 + 10 * nn; g = 105 + 20 * nn; b = 225 + 10 * nn; }
        else { r = 40 + 12 * nn; g = 185 + 20 * nn; b = 225 + 10 * nn; }
      } else if (ty === 2) {                          // 황토색 판
        const v = 0.93 + 0.07 * nn; r = 226 * v; g = 176 * v; b = 126 * v;
      } else if (ty === 3) {                          // 분홍빛 회색 판
        const v = 0.92 + 0.1 * nn; r = 160 * v; g = 138 * v; b = 152 * v;
      } else {
        const tg = Math.min(1, lowA[idx] / 24);       // 초원: 연두 → 초록
        if (tg < 0.5) { const u = tg * 2; r = mix(178, 98, u); g = mix(230, 200, u); b = mix(66, 78, u); }
        else { const u = (tg - 0.5) * 2; r = mix(98, 56, u); g = mix(200, 168, u); b = mix(78, 92, u); }
        const yp = sm(0.58, 0.7, noise(x * 0.05 + 40, j * 0.05 + 40)) * 0.6;
        r = mix(r, 214, yp); g = mix(g, 238, yp); b = mix(b, 84, yp);
        const m = mA[idx];
        if (m > 1) {                                  // 산: 주황 → 보라 → 연보라
          const tH = Math.min(1, m / 48);
          const pm = sm(0.05, 0.4, tH), hi = sm(0.45, 0.85, tH);
          let mr = mix(208, 132 + 58 * hi, pm), mg = mix(128, 100 + 70 * hi, pm), mb = mix(80, 178 + 57 * hi, pm);
          const ob = sm(0.8, 1.3, dfA[idx]) * (1 - hi * 0.6) * 0.75;   // 햇빛 받는 면은 주황
          mr = mix(mr, 208, ob); mg = mix(mg, 128, ob); mb = mix(mb, 80, ob);
          const gm = sm(1, 9, m);
          r = mix(r, mr, gm); g = mix(g, mg, gm); b = mix(b, mb, gm);
        }
      }
      const v = 0.9 + 0.2 * hash(i, j, 4);            // 빨대마다 미세한 색 차이
      const hz = 0.2 * Math.pow(1 - j / M, 2);        // 먼 곳은 따뜻한 안개
      cr[idx] = mix(r * v, 240, hz); cg[idx] = mix(g * v, 200, hz); cb[idx] = mix(b * v, 160, hz);
    }
  }
}

// ───────────────────────── 기둥 그리기 ─────────────────────────
function drawColumn(i, j) {
  const idx = j * N + i, h = ht[idx], x = i - N / 2 + 0.5, z = M - 1 - j;
  proj(x, h, z - 0.5);
  const fx = PX, fty = PY, fs = PS;
  let fby = fty;
  const inI = i < N / 2 ? i + 1 : i - 1;
  const hS = ht[j * N + inI];
  const hF = Math.min(j < M - 1 ? ht[idx + N] : Math.max(0, h - 60), hS);   // 이웃보다 낮은 쪽까지 앞면을 내려 틈을 막음
  if (hF < h) { proj(x, hF, z - 0.5); fby = PY; }
  if (fby < -12 || fty > H + 12 || fx < -30 || fx > W + 30) return;

  const br = cr[idx], bg = cg[idx], bb = cb[idx], sh = shA[idx], ao = aoA[idx];
  const df = dfA[idx] * (1 - 0.65 * sh) * 0.62;

  // 앞면 (햇빛 반대편이라 어둡고 푸른 그늘)
  if (fby - fty > 0.3) {
    const fl = 0.2 * (1 - sh);
    ctx.fillStyle = rgb(br * (0.46 + fl) * ao, bg * (0.50 + fl * 0.9) * ao, bb * (0.62 + fl * 0.72) * ao);
    ctx.fillRect(fx - fs / 2, fty, fs + 0.6, fby - fty + 0.6);
    if (fs > 5) {                                     // 원통의 명암
      ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(fx - fs * 0.3, fty, fs * 0.22, fby - fty);
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(fx + fs * 0.2, fty, fs * 0.3, fby - fty);
    }
  }

  // 옆면 (가운데 쪽 이웃보다 높은 부분)
  if (hS < h) {
    const sxw = i < N / 2 ? x + 0.5 : x - 0.5;
    proj(sxw, h, z + 0.5); const ax = PX, ay = PY;
    proj(sxw, h, z - 0.5); const bx = PX, by = PY;
    proj(sxw, hS, z - 0.5); const cx = PX, cy = PY;
    proj(sxw, hS, z + 0.5); const dx = PX, dy = PY;
    if (i < N / 2) { const l = 0.5 * (1 - sh); ctx.fillStyle = rgb(br * (0.5 + l) * ao, bg * (0.54 + l * 0.9) * ao, bb * (0.66 + l * 0.72) * ao); }
    else ctx.fillStyle = rgb(br * 0.4 * ao, bg * 0.43 * ao, bb * 0.55 * ao);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.lineTo(dx, dy); ctx.closePath(); ctx.fill();
  }

  // 윗면: 틈새(어두운 사각) → 빨대 단면(밝은 타원) → 구멍(어두운 타원)
  proj(x, h, z + 0.5); const fy2 = PY;
  proj(x, h, z); const tx = PX, ts = PS;
  const ty = (fty + fy2) / 2, ryF = (fty - fy2) / 2;
  const topS = rgb(br * (0.5 + df) * ao, bg * (0.54 + df * 0.9) * ao, bb * (0.66 + df * 0.72) * ao);
  const rx = ts * 0.47;
  if (rx < 1.6) {
    ctx.fillStyle = topS;
    ctx.fillRect(tx - ts / 2, fy2, ts + 0.6, fty - fy2 + 0.4);
    return;
  }
  ctx.fillStyle = rgb(br * 0.34, bg * 0.34, bb * 0.4);
  ctx.fillRect(tx - ts / 2, fy2, ts + 0.6, fty - fy2 + 0.4);
  const ry = ryF * 0.93;
  ctx.fillStyle = topS;
  ctx.beginPath(); ctx.ellipse(tx, ty, rx, ry, 0, 0, 6.2832); ctx.fill();
  ctx.fillStyle = rgb(br * 0.26, bg * 0.24, bb * 0.3);
  ctx.beginPath(); ctx.ellipse(tx, ty - ry * 0.06, rx * 0.58, ry * 0.58, 0, 0, 6.2832); ctx.fill();
}

function drawRow(j) {                                 // 바깥 → 가운데 순서로 그려 가운데가 위에 겹침
  for (let s = 0; s < N / 2; s++) { drawColumn(s, j); drawColumn(N - 1 - s, j); }
}

function finish() {                                   // 노을빛과 비네팅
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  let g = ctx.createRadialGradient(W * 0.95, H * 0.3, 10, W * 0.95, H * 0.3, W * 1.15);
  g.addColorStop(0, 'rgba(255,200,120,0.55)'); g.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  g = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.25, W / 2, H * 0.5, H * 0.75);
  g.addColorStop(0, 'rgba(20,8,30,0)'); g.addColorStop(1, 'rgba(20,8,30,0.34)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ───────────────────────── p5 ─────────────────────────
function fitCanvas() {
  const cw = Math.min(windowWidth, windowHeight * W / H);
  k = cw / W;
  return [Math.floor(cw), Math.floor(cw * H / W)];
}

function build() {
  gen();
  ctx = drawingContext;
  ctx.setTransform(pd * k, 0, 0, pd * k, 0, 0);
  ctx.fillStyle = 'rgb(120,84,92)';
  ctx.fillRect(0, 0, W, H);
  rowNext = 0; finished = false;
  loop();
}

function setup() {
  pd = Math.min(2, displayDensity());
  pixelDensity(pd);
  const [cw, ch] = fitCanvas();
  createCanvas(cw, ch);
  frameRate(60);
  build();
}

function draw() {
  if (finished) return;
  ctx.setTransform(pd * k, 0, 0, pd * k, 0, 0);
  const t0 = performance.now();
  while (rowNext < M && performance.now() - t0 < 14) drawRow(rowNext++);
  if (rowNext >= M) { finish(); finished = true; noLoop(); }
}

function windowResized() {
  const [cw, ch] = fitCanvas();
  resizeCanvas(cw, ch);
  build();
}

function mousePressed() { seed = Math.floor(Math.random() * 1e6); build(); }
function keyPressed() { if (key === 's' || key === 'S') saveCanvas('straw-terrain', 'png'); }
