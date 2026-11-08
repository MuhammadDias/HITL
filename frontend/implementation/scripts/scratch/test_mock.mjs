const STAGE_SPREADS = {
  1: [0.86, 0.09, 0.05],
  2: [0.42, 0.35, 0.23],
  3: [0.55, 0.38, 0.07],
};

function hashDrawingInput(input) {
  let hash = 0x811c9dc5;
  const push = (n) => {
    hash ^= n & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  };
  for (const stroke of input.strokes) {
    for (const p of stroke) {
      push(Math.round(p.x * 64));
      push(Math.round(p.y * 64));
    }
  }
  return hash >>> 0;
}

function pickDistinctLabels(vocabulary, seed) {
  if (vocabulary.length < 3) {
    throw new Error("Mock provider membutuhkan minimal 3 label dalam vocabulary.");
  }
  const pool = [...vocabulary];
  const picked = [];
  let s = seed;
  while (picked.length < 3) {
    s = ((Math.imul(s, 1103515245) + 12345) >>> 0) || seed + picked.length + 1;
    const idx = s % pool.length;
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

// Simulate a pointer drawing (horizontal line from left to right)
const mockInput = {
  strokes: [[
    { x: 0.2, y: 0.5 },
    { x: 0.3, y: 0.5 },
    { x: 0.4, y: 0.5 },
    { x: 0.5, y: 0.5 },
    { x: 0.6, y: 0.5 },
    { x: 0.7, y: 0.5 },
    { x: 0.8, y: 0.5 },
  ]]
};

const vocab = ["papan", "batu", "tangga", "balok"]; // Stage 1 vocabulary
const seed = hashDrawingInput(mockInput);
console.log("Seed:", seed);
const labels = pickDistinctLabels(vocab, seed);
console.log("Picked labels:", labels);
const [a, b, c] = STAGE_SPREADS[1];
console.log("Confidences:", [a, b, c]);
console.log("Top-1:", labels[0], "conf:", a);
console.log("Top-2:", labels[1], "conf:", b);
console.log("Top-3:", labels[2], "conf:", c);
