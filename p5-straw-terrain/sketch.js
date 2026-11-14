// Straw Terrain — 컬러 빨대 수만 개를 세워 만든 지형 (p5.js)
// 클릭/터치: 다시 쌓기(빨대 높낮이만 조금 달라짐) / S 키: PNG 저장
//
// 원본 이미지의 구도를 그대로 옮기기 위해, 강·산봉우리·초원 언덕의 위치를
// "화면 좌표"로 적어 두고 카메라 역투영으로 지면 좌표로 바꿔서 높이 지도를 만든다.
// 그런 다음 먼 줄부터 빨대(원통)를 하나씩 그린다.

const W = 768, H = 1376;                       // 원본 이미지 좌표계
const F = 1880, CAM_Y = 117;                   // 초점거리, 카메라 높이(단위: 빨대 지름)
const PITCH = 35 * Math.PI / 180;              // 카메라가 내려다보는 각도
const SP = Math.sin(PITCH), CP = Math.cos(PITCH);
const NX = 184, DZ = 0.866, Z_FAR = 445, Z_NEAR = 77;
const M = Math.floor((Z_FAR - Z_NEAR) / DZ);

let k = 1, pd = 1, seed = 5, ctx;
let ht, mat, lit, ao, cr, cg, cb;
let rowNext = 0, finished = false;
let PX = 0, PY = 0, PS = 0;

// ───────────── 원본에서 읽은 배치 (화면 좌표) ─────────────
// 강: [u, v, 반폭(px)]
const RIVER_MAIN = [[660, 15, 40], [640, 45, 46], [568, 105, 96], [520, 195, 88], [488, 290, 56], [478, 375, 40],
  [498, 450, 44], [522, 525, 44], [526, 600, 44], [508, 668, 46], [430, 722, 50], [335, 762, 55], [278, 840, 56],
  [266, 930, 60], [240, 1010, 72], [170, 1095, 95], [88, 1185, 112], [15, 1275, 125], [-70, 1380, 135], [-150, 1480, 140]];
const RIVER_BRANCH = [[250, 1030, 30], [330, 1082, 34], [430, 1104, 34], [520, 1128, 32], [585, 1160, 26], [612, 1186, 14]];

// 산봉우리: [꼭대기 u, 꼭대기 v, 밑동 v, 반경(빨대 수), 그룹]
// 그룹: 0 A(위 왼쪽) 1 B(가운데 왼쪽) 2 C(왼쪽 큰 산) 3 D(왼쪽 아래) 4 E(오른쪽 위) 5 F(오른쪽 가운데) 6 G(아래 주황 언덕)
const ORANGE = [0.2, 0.2, 0.35, 0.65, 0.12, 0.78, 1.0];   // 그룹별 주황 비율
const PEAKS = [
  [322, 10, 150, 13, 0], [375, 62, 150, 9, 0], [262, 62, 165, 10, 0], [300, 92, 190, 10, 0],
  [120, 165, 215, 7, 0], [190, 150, 230, 8, 0],
  [232, 198, 400, 17, 1], [350, 212, 420, 16, 1], [290, 250, 440, 16, 1], [420, 330, 470, 12, 1], [175, 262, 400, 12, 1],
  [140, 318, 640, 19, 2], [215, 352, 650, 16, 2], [300, 442, 680, 14, 2], [60, 420, 640, 14, 2], [350, 540, 690, 10, 2], [250, 560, 720, 10, 2],
  [15, 590, 760, 14, 3], [90, 650, 800, 10, 3], [40, 780, 900, 10, 3],
  [700, 140, 400, 15, 4], [745, 205, 470, 16, 4], [640, 225, 420, 12, 4], [600, 300, 450, 9, 4], [690, 300, 500, 13, 4], [760, 330, 520, 12, 4],
  [640, 690, 820, 10, 5], [745, 640, 790, 12, 5], [700, 770, 900, 10, 5], [590, 830, 930, 8, 5], [740, 900, 1040, 9, 5], [540, 790, 860, 6, 5], [710, 1000, 1100, 8, 5],
  [380, 1215, 1297, 10, 6], [500, 1260, 1342, 13, 6], [630, 1300, 1385, 13, 6], [745, 1250, 1335, 12, 6],
  [300, 1335, 1420, 8, 6], [450, 1380, 1470, 13, 6], [650, 1400, 1490, 13, 6], [768, 1380, 1470, 10, 6],
];
// 계단식 초원 언덕: [u, 밑동 v, 높이, 반경]
const BUMPS = [
  [370, 230, 15, 24], [700, 140, 8, 10], [740, 560, 13, 24], [410, 560, 8, 9], [330, 700, 7, 8],
  [540, 850, 14, 24], [400, 1060, 5, 12], [30, 960, 16, 26], [150, 830, 8, 12], [230, 1300, 6, 12], [120, 1380, 6, 10],
];
const SHAPE = [1.0, 1.0, 1.0, 0.9, 1.0, 0.7, 0];   // 그룹별 봉우리 뾰족함 (0 = 평평한 고원)

// ───────────── 유틸 ─────────────
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
function hash(i, j, s = 0) {
  const v = Math.sin(i * 127.1 + j * 311.7 + s * 74.7 + seed * 17.3) * 43758.5453;
  return v - Math.floor(v);
}
function rgb(r, g, b) {
  return 'rgb(' + (r < 0 ? 0 : r > 255 ? 255 : r | 0) + ',' + (g < 0 ? 0 : g > 255 ? 255 : g | 0) + ',' + (b < 0 ? 0 : b > 255 ? 255 : b | 0) + ')';
}
function ramp(stops, t) {                       // stops: [t, r, g, b]
  for (let q = 1; q < stops.length; q++) {
    if (t <= stops[q][0]) {
      const a = stops[q - 1], b = stops[q], u = (t - a[0]) / (b[0] - a[0]);
      return [mix(a[1], b[1], u), mix(a[2], b[2], u), mix(a[3], b[3], u)];
    }
  }
  const e = stops[stops.length - 1]; return [e[1], e[2], e[3]];
}

// 월드(x 좌우, y 높이, z 거리) → 화면
function proj(x, y, z) {
  const dy = y - CAM_Y;
  let depth = -dy * SP + z * CP; if (depth < 1) depth = 1;
  PS = F / depth;
  PX = W / 2 + x * PS;
  PY = H / 2 - (dy * CP + z * SP) * PS;
}
// 화면 → 지면(y=0)
function inv(u, v) {
  const t = (H / 2 - v) / F;
  const z = CAM_Y * (CP + t * SP) / (SP - t * CP);
  const S = F / (CAM_Y * SP + z * CP);
  return { x: (u - W / 2) / S, z, S };
}
// 꼭대기가 (u, vTop)에, 밑동이 vBase에 보이는 봉우리의 지면 위치와 높이를 구한다
function solvePeak(p) {
  const z = inv(p[0], p[2]).z;
  let lo = 0, hi = 95;
  for (let q = 0; q < 30; q++) { const m = (lo + hi) / 2; proj(0, m, z); if (PY > p[1]) lo = m; else hi = m; }
  const h = (lo + hi) / 2; proj(0, h, z);
  return { x: (p[0] - W / 2) / PS, z, h: Math.max(3, h - 5) * (p[4] === 6 ? 1 : 1.12), r: p[3], g: p[4] };   // 바닥 높이만큼 뺀다
}
function catmull(P, sub) {
  const out = [];
  for (let s = 0; s < P.length - 1; s++) {
    const p0 = P[Math.max(0, s - 1)], p1 = P[s], p2 = P[s + 1], p3 = P[Math.min(P.length - 1, s + 2)];
    for (let q = 0; q < sub; q++) {
      const t = q / sub, t2 = t * t, t3 = t2 * t, pt = [];
      for (let c = 0; c < 3; c++)
        pt.push(0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3));
      out.push(pt);
    }
  }
  out.push(P[P.length - 1]);
  return out.map(p => { const g = inv(p[0], p[1]); return { x: g.x, z: g.z, w: p[2] / g.S }; });
}
const colX = (i, j) => i - NX / 2 + 0.25 + (j & 1 ? 0.5 : 0);
const rowZ = j => Z_FAR - j * DZ;

// ───────────── 지형 생성 ─────────────
function gen() {
  randomSeed(seed); noiseSeed(seed);
  const n = NX * M;
  ht = new Float32Array(n); mat = new Uint8Array(n); lit = new Float32Array(n); ao = new Float32Array(n);
  cr = new Float32Array(n); cg = new Float32Array(n); cb = new Float32Array(n);
  const mH = new Float32Array(n), mG = new Uint8Array(n), mHf = new Float32Array(n), gH = new Float32Array(n), rDn = new Float32Array(n);

  const river = catmull(RIVER_MAIN, 8).concat(catmull(RIVER_BRANCH, 8));
  const peaks = PEAKS.map(solvePeak);
  const bumps = BUMPS.map(b => { const g = inv(b[0], b[1]); return { x: g.x, z: g.z, h: b[2], r: b[3] }; });

  for (let j = 0; j < M; j++) {
    const z = rowZ(j);
    for (let i = 0; i < NX; i++) {
      const idx = j * NX + i, x = colX(i, j);
      proj(x, 0, z); const u = PX, v = PY;

      // 강까지의 거리
      let dn = 9, de = 1e9;
      for (let q = 0; q < river.length; q++) {
        const p = river[q], d = Math.hypot(x - p.x, z - p.z);
        if (d / p.w < dn) dn = d / p.w;
        if (d - p.w < de) de = d - p.w;
      }

      const edgeN = 0.16 * (noise(x * 0.1 + 90, z * 0.1 + 70) - 0.5);
      dn += edgeN;
      // 산
      let m = 0, grp = 0, hp = 1;
      const wob = 0.7 + 0.5 * noise(x * 0.09 + 7, z * 0.09 + 3);
      for (let q = 0; q < peaks.length; q++) {
        const p = peaks[q], d = Math.hypot(x - p.x, z - p.z) / (p.r * wob);
        if (d < 1) { const e = SHAPE[p.g], c = p.h * (e ? Math.pow(1 - d, e) : sm(0, 0.3, 1 - d)); if (c > m) { m = c; grp = p.g; hp = p.h; } }
      }
      if (m > 0) {
        if (grp !== 6) {                                  // 능선과 덩어리진 들쭉날쭉함
          const rn = 1 - Math.abs(2 * noise(x * 0.12 + 30, z * 0.12 + 11) - 1);
          m *= 0.68 + 0.32 * rn;
          m *= 0.72 + 0.4 * noise(x * 0.5 + 3, z * 0.5 + 9);
          m += (hash(i, j, 1) - 0.6) * (0.8 + 0.22 * m);     // 빨대마다 높이가 달라 삐죽삐죽하다
        } else m += (hash(i, j, 1) - 0.6) * 0.9;
        if (m < 0) m = 0;
      }

      // 바닥: 강 / 판 / 계단식 초원
      let base, ty;
      const tanPlate = v < 41 || (u > 664 && v < 112);
      const grayPlate = !tanPlate && u < 252 - (v - 40) * 0.26 && v < 600;
      if (tanPlate) { ty = 4; base = v < 41 ? 0.5 : 5; m = 0; }
      else if (grayPlate) { ty = 3; base = 2.4 + hash(i, j, 2) * 0.25; }
      else if (dn < 1 && m < 1.5) {
        ty = 1; m = 0;
        const far = 1 - sm(250, 700, v);                 // 먼 쪽은 얕은 청록이 넓다
        const d1 = mix(0.4, 0.1, far), d2 = mix(0.7, 0.24, far);
        rDn[idx] = dn < d1 ? 0 : dn < d2 ? 1 : 2;
        base = dn < d1 ? 0 : dn < d2 ? 1.2 : 2.6;
        base += hash(i, j, 2) * 0.3;
      } else {
        ty = 0;
        let raw = 4 + Math.min(Math.max(de, 0) * 0.3, 5) + 3.2 * (noise(x * 0.045 + 50, z * 0.045 + 20) - 0.5);
        for (let q = 0; q < bumps.length; q++) {
          const b = bumps[q], d = Math.hypot(x - b.x, z - b.z) / b.r;
          if (d < 1) { const f = 1 - d * d; raw += b.h * f * f; }
        }
        base = Math.max(4, Math.floor(raw / 2.2) * 2.2) + hash(i, j, 2) * 0.3;
        gH[idx] = base;
      }
      if (m > 1.2) ty = 2;
      mH[idx] = m; mG[idx] = grp; mHf[idx] = clamp(m / hp, 0, 1);
      ht[idx] = base + m; mat[idx] = ty;
    }
  }

  // 그림자 · 음영 · 색
  for (let j = 0; j < M; j++) {
    const z = rowZ(j);
    for (let i = 0; i < NX; i++) {
      const idx = j * NX + i, h0 = ht[idx], x = colX(i, j);
      // 햇빛(오른쪽 뒤, 낮은 해) 쪽으로 가며 가리는 기둥이 있는지 본다
      let L = 1;
      for (let s = 1.5; s <= 46; s += 1.5) {
        const ci = Math.round(i + 0.86 * s), cj = Math.round(j - 0.5 * s / DZ);
        if (ci >= NX || cj < 0) break;
        const over = ht[cj * NX + ci] - (h0 + s * 0.75);
        if (over > 0) { L = Math.min(L, Math.max(0, 1 - over / 2.5)); if (L <= 0) break; }
      }
      lit[idx] = L;
      // 주변이 높으면 어둡게
      let sum = 0, cnt = 0;
      for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
        const jj = j + dj, ii = i + di;
        if (jj < 0 || jj >= M || ii < 0 || ii >= NX) continue;
        sum += ht[jj * NX + ii]; cnt++;
      }
      ao[idx] = clamp(1 - (sum / cnt - h0) * 0.035, 0.6, 1.08);
      // 해를 향한 경사
      const iL = i > 0 ? idx - 1 : idx, iR = i < NX - 1 ? idx + 1 : idx;
      const jN = j < M - 1 ? idx + NX : idx, jF = j > 0 ? idx - NX : idx;
      const gx = (ht[iR] - ht[iL]) * 0.5, gz = (ht[jF] - ht[jN]) * 0.5 / DZ;
      const sunF = clamp(-(gx * 0.86 + gz * 0.5) / 2.2, -1, 1);

      let c;
      const ty = mat[idx], nn = hash(i, j, 3);
      if (ty === 1) {
        const dn = rDn[idx];
        c = dn < 0.5 ? [34 + 14 * nn, 56 + 26 * nn, 196 + 30 * nn]
          : dn < 1.5 ? [36 + 14 * nn, 112 + 26 * nn, 226 + 14 * nn]
          : [56 + 20 * nn, 186 + 24 * nn, 226 + 14 * nn];
      } else if (ty === 4) c = [222, 172, 122];
      else if (ty === 3) c = [176, 150, 172];
      else {
        const t = clamp((gH[idx] - 4) / 15, 0, 1);
        c = ramp([[0, 38, 176, 118], [0.25, 74, 198, 84], [0.55, 142, 224, 72], [1, 216, 240, 92]], t);
        if (ty === 2) {
          const hf = mHf[idx], o = ORANGE[mG[idx]];
          const pur = ramp([[0, 138, 110, 188], [0.45, 184, 158, 232], [1, 224, 208, 250]], hf);
          const wO = clamp(o * sm(0.15, 0.55, hf) * 1.25 + (1 - o) * sm(0.3, 0.9, sunF) * (1 - 0.6 * hf) * 0.8
            + 0.5 * (noise(x * 0.2 + 80, z * 0.2 + 60) - 0.5), 0, 1);
          const org = [mix(204, 238, nn), mix(124, 156, nn), mix(84, 96, nn)];
          const mc = [mix(pur[0], org[0], wO), mix(pur[1], org[1], wO), mix(pur[2], org[2], wO)];
          if (mG[idx] === 6 && z < Z_NEAR + 2.2) { mc[0] = 150; mc[1] = 118; mc[2] = 190; }   // 맨 앞줄은 보라색 벽
          const gm = sm(1.2, 4, mH[idx]);
          c = [mix(c[0], mc[0], gm), mix(c[1], mc[1], gm), mix(c[2], mc[2], gm)];
        }
      }
      const vv = 0.9 + 0.2 * hash(i, j, 4);
      const dfN = ty === 2 ? 0.86 + 0.3 * sunF : 1;
      cr[idx] = c[0] * vv * dfN; cg[idx] = c[1] * vv * dfN; cb[idx] = c[2] * vv * dfN;
    }
  }
}

// ───────────── 빨대 하나 그리기 ─────────────
function drawColumn(i, j) {
  const idx = j * NX + i, h = ht[idx], x = colX(i, j), z = rowZ(j);
  proj(x, h, z);
  const tx = PX, ty = PY, rx = PS * 0.5;
  if (tx < -rx - 2 || tx > W + rx + 2) return;
  // 앞줄 이웃 중 가장 낮은 곳까지 몸통을 그린다
  let hb = 0;
  if (j < M - 2) {
    const a = idx + NX, o = (j & 1) ? 1 : -1;
    hb = Math.min(ht[a], ht[clamp(a + o, (j + 1) * NX, (j + 2) * NX - 1)], ht[idx + 2 * NX]);
  }
  let by = ty;
  if (hb < h) { proj(x, hb, z); by = PY; }
  if (by < -4) return;
  proj(x, h, z + 0.5); const y1 = PY;
  proj(x, h, z - 0.5); const ry = (PY - y1) * 0.5;
  if (ty - ry > H + 2) return;

  const r = cr[idx], g = cg[idx], b = cb[idx], L = lit[idx], a = ao[idx];
  // 몸통: 왼쪽은 그늘, 오른쪽은 햇빛
  if (by - ty > 0.4) {
    const mf = (0.6 + 0.24 * L) * a;
    ctx.fillStyle = rgb(r * mf * 0.9, g * mf * 0.92, b * mf * 1.1);
    ctx.fillRect(tx - rx, ty, rx * 2 + 0.4, by - ty + 0.5);
    if (rx > 1.4) {
      ctx.fillStyle = rgb(r * 0.46 * a, g * 0.46 * a, b * 0.6 * a);
      ctx.fillRect(tx - rx, ty, rx * 0.55, by - ty + 0.5);
      const rf = (0.78 + 0.42 * L) * a;
      ctx.fillStyle = rgb(r * rf * 1.06, g * rf, b * rf * 0.94);
      ctx.fillRect(tx + rx * 0.18, ty, rx * 0.5, by - ty + 0.5);
    }
  }
  // 윗면: 빨대 테두리 + 구멍
  const tf = (0.7 + 0.42 * L) * a;
  const wr = mix(0.9, 1.06, L), wb = mix(1.1, 0.93, L);
  ctx.fillStyle = rgb(r * tf * wr, g * tf, b * tf * wb);
  if (rx < 1.3) { ctx.fillRect(tx - rx, ty - ry, rx * 2 + 0.3, ry * 2 + 0.3); return; }
  ctx.beginPath(); ctx.ellipse(tx, ty, rx, ry, 0, 0, 6.2832); ctx.fill();
  const hf2 = 0.44 + 0.12 * L;
  ctx.fillStyle = rgb(r * hf2, g * hf2, b * hf2 * 1.12);
  ctx.beginPath(); ctx.ellipse(tx, ty + ry * 0.05, rx * 0.6, ry * 0.6, 0, 0, 6.2832); ctx.fill();
}

function drawRow(j) { for (let i = 0; i < NX; i++) drawColumn(i, j); }

function finish() {                              // 노을빛과 가장자리 어둡게
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  let g = ctx.createRadialGradient(W * 0.9, H * 0.15, 10, W * 0.9, H * 0.15, W * 1.3);
  g.addColorStop(0, 'rgba(255,196,130,0.5)'); g.addColorStop(1, 'rgba(255,196,130,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  g = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.3, W / 2, H * 0.5, H * 0.78);
  g.addColorStop(0, 'rgba(30,10,40,0)'); g.addColorStop(1, 'rgba(30,10,40,0.22)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ───────────── p5 ─────────────
function fitCanvas() {
  const cw = Math.min(windowWidth, windowHeight * W / H);
  k = cw / W;
  return [Math.floor(cw), Math.floor(cw * H / W)];
}

function build() {
  gen();
  ctx = drawingContext;
  ctx.setTransform(pd * k, 0, 0, pd * k, 0, 0);
  ctx.fillStyle = 'rgb(214,166,118)';
  ctx.fillRect(0, 0, W, H);
  rowNext = 0; finished = false;
  loop();
}

function setup() {
  pd = Math.min(2, displayDensity());
  pixelDensity(pd);
  const [cw, ch] = fitCanvas();
  createCanvas(cw, ch);
  build();
}

function draw() {
  if (finished) return;
  ctx.setTransform(pd * k, 0, 0, pd * k, 0, 0);
  const t0 = performance.now();
  while (rowNext < M && performance.now() - t0 < 12) drawRow(rowNext++);
  if (rowNext >= M) { finish(); finished = true; noLoop(); }
}

function windowResized() {
  const [cw, ch] = fitCanvas();
  resizeCanvas(cw, ch);
  build();
}

function mousePressed() { seed = Math.floor(Math.random() * 1e6); build(); }
function keyPressed() { if (key === 's' || key === 'S') saveCanvas('straw-terrain', 'png'); }
