// Port of the desktop app's core/avatar_mesh.py (numpy) to plain TypeScript.
// Same algorithm: sweep the MediaPipe face mask's open border back over a
// skull-shaped ellipsoid, close it at the occiput, drop a tapering neck tube
// below the jaw, then normalise so crown=+1 / chin=-1. Wireframe-only, so
// vertex normals/shading rigs from the Python version are not needed here.
import { FACE_VERTS, FACE_FACES } from "./faceModel";

type Vec3 = [number, number, number];

const SKULL_C: Vec3 = [0.0, 2.0, -1.0];
const SKULL_R: Vec3 = [8.4, 12.4, 8.2];
const SKULL_POLE_RAW: Vec3 = [0.0, 0.42, -1.0];
const SKULL_RINGS = 6;
const SKULL_BLEND = 1.7;
const SKULL_BULGE = 1.04;

const NECK_RINGS = 9;
const NECK_SEGS = 14;
const NECK_Z = -1.6;
const WIRE_STRIDE = 3;

export const EYE_L = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
export const EYE_R = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];
export const LIPS_OUT = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
export const LIPS_IN = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191];

// Jaw-rig pivot and max swing, straight from avatar_mesh.py.
export const JAW_PIVOT: Vec3 = [0.0, 0.06, -0.34];
export const JAW_MAX = 0.115;

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function norm(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}
function normalize(v: Vec3): Vec3 {
  const n = norm(v) || 1e-9;
  return [v[0] / n, v[1] / n, v[2] / n];
}
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  const d = Math.max(-1, Math.min(1, dot(a, b)));
  const omega = Math.acos(d);
  const so = Math.sin(omega);
  let out: Vec3;
  if (so < 1e-6) {
    out = [a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t, a[2] * (1 - t) + b[2] * t];
  } else {
    const wa = Math.sin((1 - t) * omega) / so;
    const wb = Math.sin(t * omega) / so;
    out = [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb];
  }
  return normalize(out);
}

function ellipsoidRadius(d: Vec3, R: Vec3): number {
  const s = (d[0] / R[0]) ** 2 + (d[1] / R[1]) ** 2 + (d[2] / R[2]) ** 2;
  return 1 / Math.sqrt(s);
}

interface Mesh {
  verts: number[]; // flat x,y,z triples
  faces: number[]; // flat i0,i1,i2 triples
}

function vcount(m: Mesh) {
  return m.verts.length / 3;
}
function getV(m: Mesh, i: number): Vec3 {
  return [m.verts[i * 3], m.verts[i * 3 + 1], m.verts[i * 3 + 2]];
}
function pushV(m: Mesh, v: Vec3) {
  m.verts.push(v[0], v[1], v[2]);
}

// Ordered ring of vertices along the open border of a triangle mesh.
function boundaryLoop(m: Mesh): number[] {
  const seen = new Map<string, number>();
  const nf = m.faces.length / 3;
  for (let f = 0; f < nf; f++) {
    const a = m.faces[f * 3],
      b = m.faces[f * 3 + 1],
      c = m.faces[f * 3 + 2];
    for (const [x, y] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      const key = `${Math.min(x, y)},${Math.max(x, y)}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
  }
  const border: [number, number][] = [];
  for (const [key, n] of seen) {
    if (n === 1) {
      const [a, b] = key.split(",").map(Number);
      border.push([a, b]);
    }
  }
  const adj = new Map<number, number[]>();
  for (const [a, b] of border) {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push(b);
    adj.get(b)!.push(a);
  }
  const start = border[0][0];
  const loop = [start];
  let prev = -1;
  let cur = start;
  while (true) {
    const candidates = (adj.get(cur) ?? []).filter((v) => v !== prev);
    if (candidates.length === 0 || candidates[0] === start) break;
    prev = cur;
    cur = candidates[0];
    loop.push(cur);
  }
  return loop;
}

function addCranium(m: Mesh): Mesh {
  const loop = boundaryLoop(m);
  const n = loop.length;

  // Orient the loop so its winding matches the face's.
  let cx = 0,
    cy = 0;
  for (const i of loop) {
    cx += m.verts[i * 3];
    cy += m.verts[i * 3 + 1];
  }
  cx /= n;
  cy /= n;
  const angles = loop.map((i) => Math.atan2(m.verts[i * 3 + 1] - cy, m.verts[i * 3] - cx));
  let unwrapped = 0;
  for (let i = 1; i < angles.length; i++) {
    let diff = angles[i] - angles[i - 1];
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    unwrapped += diff;
  }
  const orderedLoop = unwrapped < 0 ? [...loop].reverse() : loop;

  const pole = normalize(SKULL_POLE_RAW);
  let chinY = Infinity;
  for (let i = 0; i < vcount(m); i++) chinY = Math.min(chinY, m.verts[i * 3 + 1]);

  const rimR: number[] = [];
  const rimD: Vec3[] = [];
  for (const i of orderedLoop) {
    const rim = sub(getV(m, i), SKULL_C);
    const r = norm(rim);
    rimR.push(r);
    rimD.push([rim[0] / r, rim[1] / r, rim[2] / r]);
  }

  const out: Mesh = { verts: [...m.verts], faces: [...m.faces] };
  let prevIdx = orderedLoop;

  const ts: number[] = [];
  for (let k = 1; k <= SKULL_RINGS; k++) ts.push(k / SKULL_RINGS);

  ts.forEach((t, ti) => {
    const w = Math.pow(1 - t, SKULL_BLEND);
    const bulgeFactor = 1 + (SKULL_BULGE - 1) * Math.pow(Math.sin(Math.PI * t), 0.8);
    let ring: Vec3[] = orderedLoop.map((_, i) => {
      const d = slerp(pole, rimD[i], 1 - t);
      const r = ellipsoidRadius(d, SKULL_R) * bulgeFactor;
      const mix = w * rimR[i] + (1 - w) * r;
      return [SKULL_C[0] + d[0] * mix, SKULL_C[1] + d[1] * mix, SKULL_C[2] + d[2] * mix];
    });

    ring = ring.map((p) => {
      if (p[1] < chinY) {
        return [p[0] * 0.55, chinY, NECK_Z + (p[2] - NECK_Z) * 0.55];
      }
      return p;
    });

    if (ti === ts.length - 1) {
      const poleR = ellipsoidRadius(pole, SKULL_R);
      const polePoint: Vec3 = [SKULL_C[0] + pole[0] * poleR, SKULL_C[1] + pole[1] * poleR, SKULL_C[2] + pole[2] * poleR];
      ring = orderedLoop.map(() => polePoint);
    }

    const base = vcount(out);
    for (const p of ring) pushV(out, p);
    const idx = orderedLoop.map((_, i) => base + i);
    for (let i = 0; i < n; i++) {
      const a0 = prevIdx[i],
        b0 = prevIdx[(i + 1) % n];
      const a1 = idx[i],
        b1 = idx[(i + 1) % n];
      out.faces.push(a0, a1, b1, a0, b1, b0);
    }
    prevIdx = idx;
  });

  return out;
}

function addNeck(m: Mesh): Mesh {
  const out: Mesh = { verts: [...m.verts], faces: [...m.faces] };
  const base = vcount(out);

  const ph: number[] = [];
  for (let j = 0; j < NECK_SEGS; j++) ph.push((2 * Math.PI * j) / NECK_SEGS);

  const ys: number[] = [];
  for (let i = 0; i < NECK_RINGS; i++) ys.push(-5.5 + (i * (-13.0 - -5.5)) / (NECK_RINGS - 1));

  const idx: number[][] = [];
  for (let i = 0; i < NECK_RINGS; i++) {
    const d = (ys[i] + 5.5) / -7.5;
    const rx = 4.6 * (1 + 0.52 * Math.pow(d, 1.9));
    const rz = 4.1 * (1 + 0.38 * Math.pow(d, 1.9));
    const row: number[] = [];
    for (let j = 0; j < NECK_SEGS; j++) {
      const x = rx * Math.cos(ph[j]);
      const z = NECK_Z + rz * Math.sin(ph[j]);
      const y = ys[i];
      row.push(base + i * NECK_SEGS + j);
      pushV(out, [x, y, z]);
    }
    idx.push(row);
  }

  for (let i = 0; i < NECK_RINGS - 1; i++) {
    for (let j = 0; j < NECK_SEGS; j++) {
      const a = idx[i][j];
      const b = idx[i][(j + 1) % NECK_SEGS];
      const c = idx[i + 1][(j + 1) % NECK_SEGS];
      const e = idx[i + 1][j];
      out.faces.push(a, b, c, a, c, e);
    }
  }

  return out;
}

function uniqueEdgesStrided(faces: number[], stride: number): [number, number][] {
  const seen = new Set<string>();
  const edges: [number, number][] = [];
  const nf = faces.length / 3;
  for (let f = 0; f < nf; f++) {
    const tri = [faces[f * 3], faces[f * 3 + 1], faces[f * 3 + 2]];
    for (let k = 0; k < 3; k++) {
      const a = tri[k],
        b = tri[(k + 1) % 3];
      const lo = Math.min(a, b),
        hi = Math.max(a, b);
      const key = `${lo},${hi}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push([lo, hi]);
      }
    }
  }
  edges.sort((p, q) => (p[0] - q[0] !== 0 ? p[0] - q[0] : p[1] - q[1]));
  return edges.filter((_, i) => i % stride === 0);
}

export interface HeadGeometry {
  positions: Float32Array; // rest-pose vertex positions (x,y,z triples)
  edgePositions: Float32Array; // rest-pose edges, pairs of [x,y,z,x,y,z,...] for LineSegments
  edgeIndices: Int32Array; // the same edges as vertex index pairs [a,b,a,b,...], for live deformation
  eyeL: Vec3;
  eyeR: Vec3;
  lipCentre: Vec3;
  jawWeight: Float32Array; // per-vertex jaw-drop influence, 0..1
  lipWeight: Float32Array; // per-vertex lip spread/round influence
}

let cache: HeadGeometry | null = null;

export function buildHead(): HeadGeometry {
  if (cache) return cache;

  let mesh: Mesh = { verts: Array.from(FACE_VERTS), faces: Array.from(FACE_FACES) };
  const nFace = vcount(mesh);
  mesh = addCranium(mesh);
  const nHead = vcount(mesh);
  mesh = addNeck(mesh);
  void nFace;

  let crown = -Infinity,
    chin = Infinity;
  for (let i = 0; i < nHead; i++) {
    const y = mesh.verts[i * 3 + 1];
    crown = Math.max(crown, y);
    chin = Math.min(chin, y);
  }
  const scale = 2.0 / (crown - chin);
  const centreY = (crown + chin) * 0.5;

  const positions = new Float32Array(mesh.verts.length);
  for (let i = 0; i < vcount(mesh); i++) {
    positions[i * 3] = mesh.verts[i * 3] * scale;
    positions[i * 3 + 1] = (mesh.verts[i * 3 + 1] - centreY) * scale;
    positions[i * 3 + 2] = mesh.verts[i * 3 + 2] * scale;
  }

  const edges = uniqueEdgesStrided(mesh.faces, WIRE_STRIDE);
  const edgePositions = new Float32Array(edges.length * 6);
  const edgeIndices = new Int32Array(edges.length * 2);
  edges.forEach(([a, b], i) => {
    edgePositions[i * 6] = positions[a * 3];
    edgePositions[i * 6 + 1] = positions[a * 3 + 1];
    edgePositions[i * 6 + 2] = positions[a * 3 + 2];
    edgePositions[i * 6 + 3] = positions[b * 3];
    edgePositions[i * 6 + 4] = positions[b * 3 + 1];
    edgePositions[i * 6 + 5] = positions[b * 3 + 2];
    edgeIndices[i * 2] = a;
    edgeIndices[i * 2 + 1] = b;
  });

  const meanOf = (idxs: number[]): Vec3 => {
    let x = 0,
      y = 0,
      z = 0;
    for (const i of idxs) {
      x += positions[i * 3];
      y += positions[i * 3 + 1];
      z += positions[i * 3 + 2];
    }
    return [x / idxs.length, y / idxs.length, z / idxs.length];
  };

  // ── jaw + lip rig weights, straight from avatar_mesh.py's build_head() ──
  // Computed on the normalised positions, where by construction chin sits at
  // y = -1.0 exactly (that's what the crown/chin normalisation solved for).
  const lipCentre = meanOf(LIPS_OUT);
  const mouthY = lipCentre[1];
  const chinY = -1.0;
  const totalVerts = positions.length / 3;

  const jawWeight = new Float32Array(totalVerts);
  const lipWeight = new Float32Array(totalVerts);
  for (let i = 0; i < totalVerts; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];

    if (i < nHead) {
      const jawT = Math.max(0, Math.min(1, (mouthY - y) / (mouthY - chinY)));
      let jaw = Math.pow(jawT, 0.8);
      jaw *= Math.max(0, Math.min(1, 0.3 + 0.85 * (z / 0.55)));
      jawWeight[i] = jaw;

      const dy = (y - lipCentre[1]) / 0.155;
      const dx = x / 0.3;
      let lips = Math.exp(-(dy * dy));
      lips *= Math.exp(-(dx * dx));
      lips *= Math.max(0, Math.min(1, z / 0.4));
      lipWeight[i] = lips;
    }
  }
  for (const i of LIPS_IN.slice(0, 10)) jawWeight[i] = 1.0;
  for (const i of LIPS_OUT.slice(0, 10)) jawWeight[i] = 0.95;

  cache = {
    positions,
    edgePositions,
    edgeIndices,
    eyeL: meanOf(EYE_L),
    eyeR: meanOf(EYE_R),
    lipCentre,
    jawWeight,
    lipWeight,
  };
  return cache;
}
