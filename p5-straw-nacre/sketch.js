// Straw Nacre — 빨대 + 자개(螺鈿) 지형 (p5.js)
// 클릭/터치: 자개 무늬와 빨대 높낮이를 바꿔 다시 쌓기 / S 키: PNG 저장
//
// - 산: 빨대 기둥(윗면에 구멍이 보임)
// - 강·계단식 평지: 무지갯빛 자개판(윗면은 매끈하게 이어지고, 벽면은 빨대 기둥)
// - 옻칠한 검은 바탕, 회문(回紋) 테두리, 상서로운 구름 무늬
// 원본의 강·봉우리·언덕 위치를 화면 좌표로 적어 두고 카메라 역투영으로 지면 좌표로 바꿔서 높이 지도를 만든다.

const W = 1116, H = 2480;                      // 원본 이미지 좌표계
const F = 2732, CAM_Y = 117;                   // 초점거리, 카메라 높이(단위: 빨대 지름)
const PITCH = 35 * Math.PI / 180;
const SP = Math.sin(PITCH), CP = Math.cos(PITCH);
const NX = 256, DZ = 0.866, Z_FAR = 585, Z_NEAR = 60;
const M = Math.floor((Z_FAR - Z_NEAR) / DZ);

let k = 1, pd = 1, seed = 8, ctx;
let ht, mat, flat, lit, ao, wr, wg, wb, tr, tg, tb;
let rowNext = 0, finished = false;
let PX = 0, PY = 0, PS = 0;

// ───────────── 원본에서 읽은 배치 (원본 픽셀 좌표) ─────────────
// 강: [u, v, 반폭(px)]
const RIVER = [[830, 60, 70], [800, 160, 75], [740, 290, 70], [700, 400, 62], [705, 500, 52], [745, 590, 45], [765, 690, 42],
  [735, 790, 44], [722, 900, 46], [705, 1000, 52], [640, 1080, 60], [540, 1150, 60], [480, 1230, 52], [450, 1330, 48],
  [438, 1440, 50], [405, 1550, 58], [340, 1660, 72], [270, 1780, 90], [200, 1910, 110], [130, 2050, 135], [50, 2200, 150],
  [-40, 2340, 170], [-120, 2480, 180], [-200, 2640, 190]];
// 산봉우리: [꼭대기 u, 꼭대기 v, 밑동 v, 밑동 반경(px), 그룹]
// 그룹: 0~4 보라·크림 산(해 받는 쪽만 주황), 3 주황 많음, 5·6 윗면이 주황인 산/언덕(6은 평평한 언덕)
const PEAKS = [
  [455, 25, 330, 130, 0], [385, 95, 350, 100, 0], [520, 120, 360, 90, 0],
  [420, 335, 690, 150, 1], [330, 360, 700, 130, 1], [510, 420, 700, 110, 1], [250, 470, 960, 150, 1], [330, 560, 960, 120, 1], [180, 560, 900, 100, 1],
  [40, 900, 1350, 160, 3], [110, 1000, 1400, 110, 3], [0, 1150, 1500, 100, 3],
  [1040, 395, 720, 150, 4], [900, 470, 760, 120, 4], [1090, 610, 900, 120, 4], [960, 600, 820, 110, 4],
  [1000, 1290, 1700, 190, 5], [1100, 1150, 1500, 150, 5], [790, 1130, 1500, 110, 5], [880, 1330, 1740, 130, 5],
  [690, 1960, 2310, 260, 6], [860, 2020, 2330, 150, 6], [560, 2020, 2320, 110, 6],
];
const SHAPE = [0.8, 0.8, 0.8, 0.8, 0.8, 0.7, 1.1];
const ORANGE = [0.0, 0.0, 0.0, 0.5, 0.1, 0, 0];
// 계단식 자개 평지: [u, 밑동 v, 높이, 반경(px)]
const BUMPS = [
  [570, 330, 13, 260], [950, 240, 8, 120], [640, 880, 8, 70], [400, 1100, 6, 70], [880, 900, 9, 360], [1000, 1050, 5, 200],
  [120, 1500, 12, 150], [220, 1330, 8, 120], [560, 1520, 6, 150], [200, 1060, 5, 100],
];

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
// 자개의 무지갯빛 (분홍 → 크림 → 하늘 → 연보라 → 민트 → 분홍)
const NACRE = [[0, 238, 176, 210], [0.2, 246, 226, 186], [0.4, 128, 218, 222], [0.6, 176, 158, 238], [0.8, 150, 226, 176], [1, 238, 176, 210]];
const WALL = [[0, 34, 112, 208], [0.18, 40, 168, 204], [0.36, 96, 196, 122], [0.62, 226, 226, 182], [1, 232, 222, 240]];

function proj(x, y, z) {                        // 월드(x 좌우, y 높이, z 거리) → 화면
  const dy = y - CAM_Y;
  let depth = -dy * SP + z * CP; if (depth < 1) depth = 1;
  PS = F / depth;
  PX = W / 2 + x * PS;
  PY = H / 2 - (dy * CP + z * SP) * PS;
}
function inv(u, v) {                            // 화면 → 지면(y=0)
  const t = (H / 2 - v) / F;
  const z = CAM_Y * (CP + t * SP) / (SP - t * CP);
  return { x: 0, z, S: F / (CAM_Y * SP + z * CP) };
}
function solvePeak(p) {                         // 꼭대기가 vTop 에, 밑동이 vBase 에 보이도록 높이를 푼다
  const g0 = inv(p[0], p[2]), z = g0.z;
  let lo = 0, hi = 110;
  for (let q = 0; q < 30; q++) { const m = (lo + hi) / 2; proj(0, m, z); if (PY > p[1]) lo = m; else hi = m; }
  const h = (lo + hi) / 2; proj(0, h, z);
  return { x: (p[0] - W / 2) / PS, z, h: Math.max(3, h - 5) * (p[4] >= 5 ? 1.05 : 1.25), r: p[3] * 1.35 / g0.S, g: p[4] };
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
  return out.map(p => { const g = inv(p[0], p[1]); return { x: (p[0] - W / 2) / g.S, z: g.z, w: p[2] * 1.4 / g.S }; });
}
const colX = (i, j) => i - NX / 2 + 0.25 + (j & 1 ? 0.5 : 0);
const rowZ = j => Z_FAR - j * DZ;

// 검은 바탕(판) 영역
function plateEdgeU(v) { return v < 260 ? 395 : v < 480 ? mix(395, 150, (v - 260) / 220) : v < 1000 ? mix(150, 46, (v - 480) / 520) : 0; }
function bottomY(u) { return u < 380 ? 99999 : u < 700 ? mix(2335, 2345, (u - 380) / 320) : u < 1000 ? mix(2345, 2255, (u - 700) / 300) : mix(2255, 2200, (u - 1000) / 116); }

// 자개 윗면 색
function nacreTop(x, z, t) {
  const n1 = noise(x * 0.035 + t * 3, z * 0.035), n2 = noise(x * 0.05 + 50, z * 0.05 + 20);
  let p = (n1 * 1.7 + n2 * 0.6 + t * 0.15) % 1; if (p < 0) p += 1;
  return ramp(NACRE, p);
}
function riverTop(x, z, v) {
  const n = noise(x * 0.05 + 2 * Math.sin(z * 0.06), z * 0.045);
  let c = ramp([[0, 16, 70, 150], [0.4, 30, 150, 200], [0.68, 120, 215, 222], [1, 232, 240, 236]], clamp((n - 0.25) * 1.9, 0, 1));
  const rg = 1 - Math.abs(2 * noise(x * 0.07 + z * 0.02 + 10, z * 0.07) - 1);
  const dark = sm(0.8, 1.0, rg) * 0.55;
  const io = ramp(NACRE, (noise(x * 0.06 + 70, z * 0.05 + 30) * 1.6) % 1);
  const wI = 0.18 + 0.4 * sm(900, 2300, v);       // 아래쪽 강일수록 무지갯빛이 짙다
  c = [mix(c[0], io[0] * 0.8, wI), mix(c[1], io[1] * 0.85, wI), mix(c[2], io[2] * 0.9, wI)];
  return [c[0] * (1 - dark) + 14 * dark, c[1] * (1 - dark) + 34 * dark, c[2] * (1 - dark) + 70 * dark];
}

// ───────────── 지형 생성 ─────────────
function gen() {
  randomSeed(seed); noiseSeed(seed);
  const n = NX * M;
  ht = new Float32Array(n); mat = new Uint8Array(n); flat = new Uint8Array(n); lit = new Float32Array(n); ao = new Float32Array(n);
  wr = new Float32Array(n); wg = new Float32Array(n); wb = new Float32Array(n);
  tr = new Float32Array(n); tg = new Float32Array(n); tb = new Float32Array(n);
  const mH = new Float32Array(n), mG = new Uint8Array(n), mHf = new Float32Array(n), gH = new Float32Array(n);

  const river = catmull(RIVER, 8);
  const peaks = PEAKS.map(solvePeak);
  const bumps = BUMPS.map(b => { const g = inv(b[0], b[1]); return { x: (b[0] - W / 2) / g.S, z: g.z, h: b[2], r: b[3] / g.S }; });

  for (let j = 0; j < M; j++) {
    const z = rowZ(j);
    for (let i = 0; i < NX; i++) {
      const idx = j * NX + i, x = colX(i, j);
      proj(x, 0, z); const u = PX, v = PY;
      if (u < -160 || u > W + 160 || v > H + 140) { mat[idx] = 9; continue; }
      if (v < 50 || u < plateEdgeU(v) || v > bottomY(u) || v > H - 44) { mat[idx] = 9; continue; }   // 검은 바탕

      // 강까지의 거리
      let dn = 9, de = 1e9;
      for (let q = 0; q < river.length; q++) {
        const p = river[q], d = Math.hypot(x - p.x, z - p.z);
        if (d / p.w < dn) dn = d / p.w;
        if (d - p.w < de) de = d - p.w;
      }
      dn += 0.16 * (noise(x * 0.1 + 90, z * 0.1 + 70) - 0.5);

      // 산
      let m = 0, grp = 0, hp = 1;
      const wob = 0.7 + 0.5 * noise(x * 0.09 + 7, z * 0.09 + 3);
      for (let q = 0; q < peaks.length; q++) {
        const p = peaks[q], d = Math.hypot(x - p.x, z - p.z) / (p.r * wob);
        if (d < 1) { const e = SHAPE[p.g], c = p.h * (e ? Math.pow(1 - d, e) : sm(0, 0.3, 1 - d)); if (c > m) { m = c; grp = p.g; hp = p.h; } }
      }
      if (m > 0) {
        if (true) {
          const rn = 1 - Math.abs(2 * noise(x * 0.12 + 30, z * 0.12 + 11) - 1);
          m *= 0.68 + 0.32 * rn;
          m *= 0.72 + 0.4 * noise(x * 0.5 + 3, z * 0.5 + 9);
          m += (hash(i, j, 1) - 0.6) * (0.8 + 0.22 * m);
        }
        if (m < 0) m = 0;
      }

      let base, ty;
      const block = u > 940 && v < 190;            // 오른쪽 위 어두운 받침
      if (block) { ty = 4; base = 7; m = 0; }
      else if (dn < 1 && m < 1.5) {                // 강
        ty = 1; m = 0; base = 0.2 * hash(i, j, 2);
      } else {                                      // 계단식 자개 평지
        ty = 0;
        let raw = 3.5 + Math.min(Math.max(de, 0) * 0.6, 15) + 9 * (noise(x * 0.03 + 50, z * 0.03 + 20) - 0.5) + 3 * (noise(x * 0.09 + 5, z * 0.09 + 9) - 0.5);
        for (let q = 0; q < bumps.length; q++) {
          const b = bumps[q], d = Math.hypot(x - b.x, z - b.z) / b.r;
          if (d < 1) { const f = 1 - d * d; raw += b.h * f * f; }
        }
        base = Math.max(4, Math.floor(raw / 3.0) * 3.0);
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
      const idx = j * NX + i;
      if (mat[idx] === 9) continue;
      const h0 = ht[idx], x = colX(i, j);
      let L = 1;
      for (let s = 1.5; s <= 46; s += 1.5) {       // 해(오른쪽 뒤, 낮게) 쪽을 가리는 기둥이 있는지
        const ci = Math.round(i + 0.86 * s), cj = Math.round(j - 0.5 * s / DZ);
        if (ci >= NX || cj < 0) break;
        const over = ht[cj * NX + ci] - (h0 + s * 0.75);
        if (over > 0) { L = Math.min(L, Math.max(0, 1 - over / 2.5)); if (L <= 0) break; }
      }
      lit[idx] = L;
      let sum = 0, cnt = 0;
      for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
        const jj = j + dj, ii = i + di;
        if (jj < 0 || jj >= M || ii < 0 || ii >= NX) continue;
        sum += ht[jj * NX + ii]; cnt++;
      }
      ao[idx] = clamp(1 - (sum / cnt - h0) * 0.03, 0.6, 1.08);
      const iL = i > 0 ? idx - 1 : idx, iR = i < NX - 1 ? idx + 1 : idx;
      const jN = j < M - 1 ? idx + NX : idx, jF = j > 0 ? idx - NX : idx;
      const gx = (ht[iR] - ht[iL]) * 0.5, gz = (ht[jF] - ht[jN]) * 0.5 / DZ;
      const sunF = clamp(-(gx * 0.86 + gz * 0.5) / 2.2, -1, 1);

      const ty = mat[idx], nn = hash(i, j, 3);
      let W_, T_;
      proj(x, 0, z); const v = PY;
      if (ty === 4) { W_ = [60, 42, 46]; T_ = [52, 36, 42]; flat[idx] = 1; }
      else if (ty === 1) { W_ = [30, 110, 200]; T_ = riverTop(x, z, v); flat[idx] = 1; }
      else {
        const t = clamp((gH[idx] - 4) / 20, 0, 1);
        W_ = ramp(WALL, t);
        T_ = nacreTop(x, z, t);
        flat[idx] = 1;
        if (ty === 2) {
          const hf = mHf[idx], grp = mG[idx];
          let c;
          if (grp >= 5) {                           // 윗면이 주황인 산/언덕
            const wO = sm(0.45, 0.8, hf);
            const dk = ramp([[0, 112, 88, 108], [1, 150, 120, 140]], hf);
            c = [mix(dk[0], mix(222, 244, nn), wO), mix(dk[1], mix(142, 168, nn), wO), mix(dk[2], mix(88, 102, nn), wO)];
          } else {                                   // 자개빛 크림·연보라 산, 해 받는 쪽은 주황
            const pur = ramp([[0, 150, 134, 176], [0.5, 206, 190, 236], [1, 240, 232, 252]], hf);
            const wO = clamp(sm(0.12, 0.6, sunF) * 0.95 * (1 - 0.35 * hf) + ORANGE[grp] * 0.5 + 0.45 * (noise(x * 0.2 + 80, z * 0.2 + 60) - 0.5), 0, 1);
            const org = [mix(226, 246, nn), mix(140, 170, nn), mix(84, 104, nn)];
            c = [mix(pur[0], org[0], wO), mix(pur[1], org[1], wO), mix(pur[2], org[2], wO)];
          }
          const gm = sm(1.2, 4, mH[idx]);
          const dfN = 0.86 + 0.3 * sunF, vv = 0.92 + 0.16 * hash(i, j, 4);
          W_ = [mix(W_[0], c[0] * dfN * vv, gm), mix(W_[1], c[1] * dfN * vv, gm), mix(W_[2], c[2] * dfN * vv, gm)];
          T_ = [mix(T_[0], c[0] * dfN * vv, gm), mix(T_[1], c[1] * dfN * vv, gm), mix(T_[2], c[2] * dfN * vv, gm)];
          if (gm > 0.6) flat[idx] = 0;               // 산은 빨대 단면(구멍)이 보인다
        }
      }
      const hz = 0.1 * Math.pow(1 - j / M, 2);
      wr[idx] = mix(W_[0], 240, hz); wg[idx] = mix(W_[1], 210, hz); wb[idx] = mix(W_[2], 190, hz);
      tr[idx] = mix(T_[0], 240, hz); tg[idx] = mix(T_[1], 210, hz); tb[idx] = mix(T_[2], 190, hz);
    }
  }
}

// ───────────── 빨대 하나 그리기 ─────────────
function drawColumn(i, j) {
  const idx = j * NX + i;
  if (mat[idx] === 9) return;
  const h = ht[idx], x = colX(i, j), z = rowZ(j);
  proj(x, h, z);
  const tx = PX, ty = PY, rx = PS * 0.5;
  if (tx < -rx - 2 || tx > W + rx + 2) return;
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

  const r = wr[idx], g = wg[idx], b = wb[idx], L = lit[idx], a = ao[idx];
  if (by - ty > 0.4) {                               // 벽: 왼쪽은 그늘, 오른쪽은 햇빛
    const mf = (0.6 + 0.24 * L) * a;
    ctx.fillStyle = rgb(r * mf * 0.9, g * mf * 0.92, b * mf * 1.1);
    ctx.fillRect(tx - rx, ty, rx * 2 + 0.4, by - ty + 0.5);
    if (rx > 1.4) {
      ctx.fillStyle = rgb(r * 0.46 * a, g * 0.46 * a, b * 0.6 * a);
      ctx.fillRect(tx - rx, ty, rx * 0.5, by - ty + 0.5);
      const rf = (0.78 + 0.42 * L) * a;
      ctx.fillStyle = rgb(r * rf * 1.06, g * rf, b * rf * 0.94);
      ctx.fillRect(tx + rx * 0.16, ty, rx * 0.5, by - ty + 0.5);
    }
  }
  const T0 = tr[idx], T1 = tg[idx], T2 = tb[idx];
  if (flat[idx]) {                                   // 자개판: 매끈하게 이어지는 윗면
    const tf = (0.58 + 0.4 * L) * a, sh = 1 - L;
    ctx.fillStyle = rgb(T0 * tf * (1 - 0.08 * sh), T1 * tf * (1 - 0.03 * sh), T2 * tf * (1 + 0.06 * sh));
    ctx.fillRect(tx - rx - 0.35, ty - ry * 0.95, rx * 2 + 0.7, ry * 1.9 + 0.5);
    return;
  }
  const tf = (0.7 + 0.42 * L) * a;                   // 빨대 윗면: 테두리 + 구멍
  const wr_ = mix(0.9, 1.06, L), wb_ = mix(1.1, 0.93, L);
  ctx.fillStyle = rgb(T0 * tf * wr_, T1 * tf, T2 * tf * wb_);
  if (rx < 1.3) { ctx.fillRect(tx - rx, ty - ry, rx * 2 + 0.3, ry * 2 + 0.3); return; }
  ctx.beginPath(); ctx.ellipse(tx, ty, rx, ry * 0.93, 0, 0, 6.2832); ctx.fill();
  const hf2 = 0.44 + 0.12 * L;
  ctx.fillStyle = rgb(T0 * hf2, T1 * hf2, T2 * hf2 * 1.12);
  ctx.beginPath(); ctx.ellipse(tx, ty + ry * 0.05, rx * 0.6, ry * 0.56, 0, 0, 6.2832); ctx.fill();
}

function drawRow(j) { for (let i = 0; i < NX; i++) drawColumn(i, j); }

// ───────────── 옻칠 바탕 · 회문 테두리 · 구름 ─────────────
function keyBand(x0, y0, len, wd, mode) {         // mode: 0 가로, 1 세로(왼쪽), 2 세로(오른쪽)
  ctx.save();
  if (mode === 0) ctx.translate(x0, y0);
  else if (mode === 1) { ctx.translate(wd, 0); ctx.rotate(Math.PI / 2); }
  else { ctx.translate(W, 0); ctx.rotate(Math.PI / 2); }
  ctx.fillStyle = 'rgb(14,12,20)'; ctx.fillRect(0, 0, len, wd);
  ctx.strokeStyle = 'rgba(238,230,214,0.85)'; ctx.lineWidth = Math.max(1.4, wd * 0.07); ctx.lineJoin = 'miter';
  const s = wd * 0.62, a = wd * 0.18;
  ctx.beginPath();
  for (let kx = 2; kx < len - s; kx += s) {
    ctx.moveTo(kx, wd - a); ctx.lineTo(kx, a); ctx.lineTo(kx + s * 0.8, a); ctx.lineTo(kx + s * 0.8, wd - a * 2);
    ctx.lineTo(kx + s * 0.3, wd - a * 2); ctx.lineTo(kx + s * 0.3, a * 2.1); ctx.lineTo(kx + s * 0.55, a * 2.1);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(238,230,214,0.55)'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(0, wd + 6); ctx.lineTo(len, wd + 6); ctx.stroke();
  ctx.restore();
}

function cloud(cx, cy, s) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.strokeStyle = 'rgba(246,240,228,0.92)'; ctx.lineWidth = 2.4 / Math.sqrt(s); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const spiral = (x, y, r, dir) => {
    ctx.beginPath();
    for (let t = 0; t < 9; t += 0.2) {
      const rr = r * (1 - t / 10), ang = t * dir, px = x + rr * Math.cos(ang), py = y + rr * Math.sin(ang);
      if (t) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.stroke();
  };
  spiral(-34, -4, 16, 1); spiral(8, -14, 12, -1);
  ctx.beginPath(); ctx.moveTo(-50, 8); ctx.bezierCurveTo(-30, 22, -6, 20, 10, 10); ctx.bezierCurveTo(30, 0, 44, 10, 72, 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-30, 22); ctx.bezierCurveTo(-10, 34, 20, 30, 50, 22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-6, -26); ctx.bezierCurveTo(20, -34, 40, -20, 62, -12); ctx.stroke();
  ctx.restore();
}

function paintBackdrop() {
  ctx.fillStyle = 'rgb(18,18,30)'; ctx.fillRect(0, 0, W, H);
  let g = ctx.createRadialGradient(220, 220, 10, 220, 220, 600);
  g.addColorStop(0, 'rgba(70,80,120,0.35)'); g.addColorStop(1, 'rgba(70,80,120,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // 아래 갈색 받침
  ctx.fillStyle = 'rgb(52,32,36)';
  ctx.beginPath(); ctx.moveTo(380, H); ctx.lineTo(380, 2335); ctx.lineTo(700, 2345); ctx.lineTo(1000, 2255); ctx.lineTo(W, 2200); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  g = ctx.createLinearGradient(0, 2200, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = g; ctx.fillRect(380, 2200, W, H);
  // 검은 바탕 위에 흩어진 어두운 빨대 단면
  for (let q = 0; q < 90; q++) {
    const px = random(60, 380), py = random(120, 340), pr = random(3, 7);
    if (px > plateEdgeU(py) - 10) continue;
    ctx.fillStyle = 'rgb(8,8,14)'; ctx.beginPath(); ctx.arc(px, py, pr, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = 'rgba(120,110,140,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(px, py, pr * 0.85, 0.3, 2.6); ctx.stroke();
  }
  for (let q = 0; q < 40; q++) {
    const py = random(330, 720), px = random(56, 170);
    if (px > plateEdgeU(py) - 6) continue;
    ctx.fillStyle = 'rgb(8,8,14)'; ctx.beginPath(); ctx.arc(px, py, random(3, 6), 0, 6.2832); ctx.fill();
  }
  keyBand(0, 0, H, 46, 1);
  keyBand(0, 0, H, 46, 2);
}

function finish() {
  keyBand(0, 0, W, 22, 0);                              // 위·아래 테두리는 지형 위에 다시 칠한다
  ctx.fillStyle = 'rgb(14,12,20)'; ctx.fillRect(0, H - 40, W, 40);
  ctx.save(); ctx.translate(0, H - 40); keyBand(0, 0, W, 34, 0); ctx.restore();
  cloud(1052, 68, 1.35); cloud(1012, 112, 0.95);        // 오른쪽 위 받침 위의 구름
  cloud(950, 2372, 2.0);                                 // 아래 받침의 구름
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  let g = ctx.createRadialGradient(W * 0.9, H * 0.18, 10, W * 0.9, H * 0.18, W * 1.4);
  g.addColorStop(0, 'rgba(255,200,140,0.5)'); g.addColorStop(1, 'rgba(255,200,140,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  g = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.3, W / 2, H * 0.5, H * 0.78);
  g.addColorStop(0, 'rgba(10,6,20,0)'); g.addColorStop(1, 'rgba(10,6,20,0.3)');
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
  paintBackdrop();
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
function keyPressed() { if (key === 's' || key === 'S') saveCanvas('straw-nacre', 'png'); }
