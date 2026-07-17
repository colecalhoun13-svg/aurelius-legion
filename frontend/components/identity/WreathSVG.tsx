// AURELIUS — THE WREATH, DRAWN IN CODE
// The old crest was a PNG stretched to 108vmin — visibly pixelated at boot.
// This is the same laurel ring as pure SVG: crisp at any size, and each leaf
// is its own element so the startup can ASSEMBLE the wreath — stems drawing
// upward, leaves unfurling in sequence up both branches until they meet.
//
// variants: "gold" (startup — bright, gradient) · "olive" (watermark — the
// weathered field tone the dashboard already uses).

const CX = 250;
const CY = 250;
const R = 175;
const LEAVES = 14;
const SWEEP_FROM = 90; // degrees — bottom center
const SWEEP_TO = -52; // degrees — branch tip, upper side

type LeafSpec = { x: number; y: number; rot: number; k: number };

function rightBranch(): LeafSpec[] {
  const leaves: LeafSpec[] = [];
  for (let k = 0; k < LEAVES; k++) {
    const a = SWEEP_FROM + (k / (LEAVES - 1)) * (SWEEP_TO - SWEEP_FROM);
    const rad = (a * Math.PI) / 180;
    const x = CX + R * Math.cos(rad);
    const y = CY + R * Math.sin(rad);
    // Leaf points along the branch's direction of travel, alternating tilt
    // inward/outward like a real laurel.
    const rot = a + (k % 2 === 0 ? 26 : -18);
    leaves.push({ x: +x.toFixed(1), y: +y.toFixed(1), rot: +rot.toFixed(1), k });
  }
  return leaves;
}

const BRANCH = rightBranch();

// Stem follows the same anchors — a polyline is indistinguishable from an arc
// at stroke width 3 and never gambles on arc sweep flags.
const STEM_D = BRANCH.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

// A pointed laurel leaf, base at origin, tip at (0,-34).
const LEAF_D = "M 0 0 Q 7.5 -10 3.4 -26 Q 0 -35 -3.4 -26 Q -7.5 -10 0 0 Z";

function Branch({ animated, stroke, fill }: { animated: boolean; stroke: string; fill: string }) {
  return (
    <>
      <path
        d={STEM_D}
        fill="none"
        stroke={stroke}
        strokeWidth={3}
        strokeLinecap="round"
        pathLength={100}
        className={animated ? "wreath-stem" : undefined}
      />
      {BRANCH.map((leaf) => (
        <g key={leaf.k} transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.rot})`}>
          <path
            d={LEAF_D}
            fill={fill}
            stroke={stroke}
            strokeWidth={0.75}
            className={animated ? "wreath-leaf" : undefined}
            style={animated ? { animationDelay: `${leaf.k * 62}ms` } : undefined}
          />
        </g>
      ))}
    </>
  );
}

export default function WreathSVG({
  variant = "olive",
  animated = false,
  className,
}: {
  variant?: "gold" | "olive";
  animated?: boolean;
  className?: string;
}) {
  const gradId = `wreathGrad-${variant}`;
  const stroke = variant === "gold" ? "#b8963f" : "#5d5738";
  const fill = `url(#${gradId})`;
  return (
    <svg viewBox="0 0 500 500" className={className} aria-hidden focusable="false">
      <defs>
        {variant === "gold" ? (
          <linearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#8a7433" />
            <stop offset="55%" stopColor="#d4af37" />
            <stop offset="100%" stopColor="#f0e0a8" />
          </linearGradient>
        ) : (
          <linearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#4a4530" />
            <stop offset="100%" stopColor="#6b6540" />
          </linearGradient>
        )}
      </defs>
      {/* Right branch, and its mirror — one geometry, two sides, identical timing
          so the branches genuinely COME TOGETHER at the tips. */}
      <Branch animated={animated} stroke={stroke} fill={fill} />
      <g transform={`translate(${2 * CX} 0) scale(-1 1)`}>
        <Branch animated={animated} stroke={stroke} fill={fill} />
      </g>
    </svg>
  );
}
