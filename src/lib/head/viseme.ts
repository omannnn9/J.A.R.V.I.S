// Port of the desktop app's core/viseme.py: text → mouth shape.
// Every character reduces to a bare Latin letter (Unicode decomposition for
// accents, transliteration for Cyrillic/Greek), so one ~20-rule table covers
// every Latin-script language and most others degrade cleanly rather than
// miming nonsense. See viseme.py's own module docstring for the full case.

// (openness 0..1, width -1..+1 spread/round, closure 0..1 — forces lips shut
// regardless of openness, which is the whole reason to consult the text at
// all: a spectrum can't tell "m" from "n", a face can).
export const VISEMES: Record<string, [number, number, number]> = {
  REST: [0.0, 0.0, 0.0],
  AA: [0.92, -0.05, 0.0],
  E: [0.52, 0.42, 0.0],
  I: [0.2, 0.62, 0.0],
  O: [0.55, -0.52, 0.0],
  U: [0.26, -0.74, 0.0],
  MBP: [0.0, 0.0, 1.0],
  FV: [0.1, 0.22, 0.55],
  S: [0.16, 0.42, 0.0],
  L: [0.36, 0.18, 0.0],
  TD: [0.28, 0.12, 0.0],
  K: [0.3, -0.04, 0.0],
  R: [0.28, -0.16, 0.0],
};

const DUR: Record<string, number> = {
  REST: 1.0,
  AA: 1.15,
  E: 1.05,
  I: 1.0,
  O: 1.1,
  U: 1.05,
  MBP: 0.5,
  FV: 0.8,
  S: 0.9,
  L: 0.65,
  TD: 0.5,
  K: 0.55,
  R: 0.55,
};

const LETTER: Record<string, string> = {
  a: "AA",
  e: "E",
  i: "I",
  y: "I",
  o: "O",
  u: "U",
  w: "U",
  b: "MBP",
  p: "MBP",
  m: "MBP",
  f: "FV",
  v: "FV",
  s: "S",
  z: "S",
  c: "S",
  j: "S",
  x: "S",
  l: "L",
  t: "TD",
  d: "TD",
  n: "TD",
  k: "K",
  g: "K",
  h: "K",
  q: "K",
  r: "R",
};

const UNDECOMPOSED: Record<string, string> = {
  ı: "i",
  ø: "o",
  đ: "d",
  ħ: "h",
  ŀ: "l",
  ŧ: "t",
  ß: "s",
  æ: "a",
  œ: "o",
  þ: "t",
  ð: "d",
  ŋ: "n",
  ł: "l",
};

const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e",
  ж: "j", з: "z", и: "i", й: "i", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ф: "f", х: "h", ц: "s", ч: "s", ш: "s", щ: "s", ъ: "",
  ы: "i", ь: "", э: "e", ю: "u", я: "a",
  і: "i", ї: "i", є: "e", ґ: "g", ў: "u",
};

const GREEK: Record<string, string> = {
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i",
  θ: "t", ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "s",
  ο: "o", π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "i",
  φ: "f", χ: "h", ψ: "s", ω: "o",
};

const MIN_COVERAGE = 0.55;

const DIGRAPH: Record<string, string> = {
  sh: "S", ch: "S", ts: "S",
  th: "TD", ck: "K", ng: "K", gh: "K",
  ph: "FV",
  oo: "U", ou: "O", ow: "O", wh: "U",
  ee: "I", ea: "I", ie: "I",
  qu: "K",
};

const PAUSE = new Set([".", ",", ";", ":", "!", "?", "…", "\n"]);

export function toLatin(ch: string): string {
  const c = ch.toLowerCase();
  if (c >= "a" && c <= "z") return c;
  if (c in UNDECOMPOSED) return UNDECOMPOSED[c];
  if (c in CYRILLIC) return CYRILLIC[c];
  if (c in GREEK) return GREEK[c];
  const base = Array.from(c.normalize("NFD")).filter((k) => !/\p{Mn}/u.test(k)).join("");
  if (base.length === 1 && base >= "a" && base <= "z") return base;
  if (base && base !== c) return toLatin(base[0]);
  return "";
}

export function coverage(text: string): number {
  const letters = Array.from(text || "").filter((c) => /\p{L}/u.test(c));
  if (letters.length === 0) return 0;
  return letters.filter((c) => toLatin(c)).length / letters.length;
}

export type VisemeSegment = [viseme: string, durationWeight: number];

export function textToVisemes(text: string): VisemeSegment[] {
  const s = (text || "").toLowerCase();
  if (coverage(s) < MIN_COVERAGE) return [];

  const out: VisemeSegment[] = [];
  const chars = Array.from(s);
  let i = 0;
  const n = chars.length;
  while (i < n) {
    const ch = chars[i];
    if (PAUSE.has(ch)) {
      out.push(["REST", 1.4]);
      i += 1;
      continue;
    }
    if (/\s/.test(ch)) {
      if (out.length && out[out.length - 1][0] !== "REST") {
        out.push([out[out.length - 1][0], 0.35]);
      }
      i += 1;
      continue;
    }

    const two = toLatin(ch) + (i + 1 < n ? toLatin(chars[i + 1]) : "");
    let v: string | undefined;
    if (two.length === 2 && two in DIGRAPH) {
      v = DIGRAPH[two];
      i += 2;
    } else {
      const base = toLatin(ch);
      i += 1;
      if (!base) continue;
      v = LETTER[base];
      if (!v) continue;
    }
    if (out.length && out[out.length - 1][0] === v) continue;
    out.push([v, DUR[v]]);
  }
  return out;
}
