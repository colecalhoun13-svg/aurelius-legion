// AURELIUS — THE CREST, DRAWN IN CODE (matched to the real artwork)
// Modeled on public/crest/aurelius-crest.png: beveled metallic-gold laurel,
// slim sharp leaves with dark center veins, the two branches CROSSED in an X
// at the bottom, tips opening at the top — and the faceted "A" at center.
// Pure SVG (crisp at any size); each leaf is its own element so the startup
// can assemble the wreath leaf by leaf.
//
// variants: "gold" (startup — bright metal) · "olive" (watermark — weathered
// field tone, letterform omitted like the original watermark).

const CX = 250;
const CY = 250;
const R = 158;
const NODES = 14;
// Branch sweeps: start PAST bottom-center (so the stems cross in an X, like
// the artwork) and climb to an open gap at the top.
const SWEEP_FROM = 118; // degrees — past bottom center (creates the cross)
const SWEEP_TO = -58; // degrees — branch tip, upper side

type LeafSpec = { x: number; y: number; rot: number; len: number; k: number; inner: boolean };

function branchLeaves(): LeafSpec[] {
  const leaves: LeafSpec[] = [];
  for (let k = 0; k < NODES; k++) {
    const a = SWEEP_FROM + (k / (NODES - 1)) * (SWEEP_TO - SWEEP_FROM);
    const rad = (a * Math.PI) / 180;
    const x = CX + R * Math.cos(rad);
    const y = CY + R * Math.sin(rad);
    // Leaves shrink slightly toward the tip, like the artwork.
    const len = 58 - k * 1.6;
    // A herringbone PAIR at each node — one flared OUTWARD of the stem, one
    // INWARD — the dense V-pairs that give the real crest its fullness.
    leaves.push({ x: +x.toFixed(1), y: +y.toFixed(1), rot: +(a + 38).toFixed(1), len, k, inner: false });
    leaves.push({ x: +x.toFixed(1), y: +y.toFixed(1), rot: +(a - 14).toFixed(1), len: len * 0.9, k, inner: true });
  }
  return leaves;
}

const LEAVES = branchLeaves();

// Stem polyline along the same arc (no arc-flag gambling).
const STEM_D = Array.from({ length: NODES }, (_, k) => {
  const a = SWEEP_FROM + (k / (NODES - 1)) * (SWEEP_TO - SWEEP_FROM);
  const rad = (a * Math.PI) / 180;
  return `${k === 0 ? "M" : "L"} ${(CX + R * Math.cos(rad)).toFixed(1)} ${(CY + R * Math.sin(rad)).toFixed(1)}`;
}).join(" ");

// A slim, sharp metallic leaf: base at origin, tip at (0,-len).
function leafPath(len: number): string {
  const w = Math.max(7, len * 0.21);
  return `M 0 0 C ${w} ${-len * 0.28}, ${w * 0.72} ${-len * 0.66}, 0 ${-len} C ${-w * 0.72} ${-len * 0.66}, ${-w} ${-len * 0.28}, 0 0 Z`;
}

function Branch({ animated, stroke, fill, vein }: { animated: boolean; stroke: string; fill: string; vein: string }) {
  return (
    <>
      <path
        d={STEM_D}
        fill="none"
        stroke={stroke}
        strokeWidth={4}
        strokeLinecap="round"
        pathLength={100}
        className={animated ? "wreath-stem" : undefined}
      />
      {LEAVES.map((leaf, i) => (
        <g key={i} transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.rot})`}>
          <g
            className={animated ? "wreath-leaf" : undefined}
            style={animated ? { animationDelay: `${leaf.k * 68 + (leaf.inner ? 34 : 0)}ms` } : undefined}
          >
            <path d={leafPath(leaf.len)} fill={fill} stroke={stroke} strokeWidth={0.6} />
            {/* the dark center vein that gives the artwork its metallic read */}
            <path d={`M 0 -3 L 0 ${-(leaf.len - 4)}`} stroke={vein} strokeWidth={1.4} strokeLinecap="round" fill="none" />
          </g>
        </g>
      ))}
    </>
  );
}

/** The faceted letterform, matched to the crest: chunky legs, low crossbar,
 * flared feet. Two gradients angled against each other fake the bevel. */
function FacetedA({ animated }: { animated: boolean }) {
  return (
    <g className={animated ? "crest-a" : undefined}>
      {/* left leg — lit face; single sharp apex, hollow counter */}
      <polygon points="250,172 198,338 226,338 250,208" fill="url(#aFaceLight)" stroke="#8a6a12" strokeWidth={1} />
      {/* right leg — shadow face */}
      <polygon points="250,172 302,338 274,338 250,208" fill="url(#aFaceDark)" stroke="#8a6a12" strokeWidth={1} />
      {/* flared feet, like the artwork */}
      <polygon points="198,338 226,338 232,350 188,350" fill="url(#aFaceLight)" stroke="#8a6a12" strokeWidth={1} />
      <polygon points="274,338 302,338 312,350 268,350" fill="url(#aFaceDark)" stroke="#8a6a12" strokeWidth={1} />
      {/* crossbar, low like the artwork */}
      <polygon points="233,290 267,290 272,308 228,308" fill="url(#aFaceLight)" stroke="#8a6a12" strokeWidth={1} />
    </g>
  );
}

export default function WreathSVG({
  variant = "olive",
  animated = false,
  showA = false,
  className,
}: {
  variant?: "gold" | "olive";
  animated?: boolean;
  showA?: boolean;
  className?: string;
}) {
  const gradId = `wreathGrad-${variant}`;
  const isGold = variant === "gold";
  const stroke = isGold ? "#8a6a12" : "#4d4830";
  const vein = isGold ? "#5c4408" : "#35311f";
  const fill = `url(#${gradId})`;
  return (
    <svg viewBox="0 0 500 500" className={className} aria-hidden focusable="false">
      <defs>
        {isGold ? (
          <linearGradient id={gradId} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#6e520f" />
            <stop offset="38%" stopColor="#d4a017" />
            <stop offset="62%" stopColor="#ffe066" />
            <stop offset="100%" stopColor="#9a7a14" />
          </linearGradient>
        ) : (
          <linearGradient id={gradId} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#45402c" />
            <stop offset="100%" stopColor="#6b6540" />
          </linearGradient>
        )}
        <linearGradient id="aFaceLight" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffe98f" />
          <stop offset="55%" stopColor="#e9b52a" />
          <stop offset="100%" stopColor="#a87e12" />
        </linearGradient>
        <linearGradient id="aFaceDark" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d9a41f" />
          <stop offset="60%" stopColor="#a87e12" />
          <stop offset="100%" stopColor="#6e520f" />
        </linearGradient>
      </defs>
      {/* Right branch, and its mirror — one geometry, two sides, identical
          timing, stems crossing at the bottom like the artwork. */}
      <Branch animated={animated} stroke={stroke} fill={fill} vein={vein} />
      <g transform={`translate(${2 * CX} 0) scale(-1 1)`}>
        <Branch animated={animated} stroke={stroke} fill={fill} vein={vein} />
      </g>
      {showA && <FacetedA animated={animated} />}
    </svg>
  );
}
