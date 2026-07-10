// LAUREL WREATH — drawn, not pasted. Two mirrored branches of leaves along
// an arc, crossed stems at the base, open crown at the top — the mockup's
// background wreath, as crisp vector. No letterform; the crest keeps the A,
// the field does not.

type Props = { size?: number | string; className?: string };

function Branch({ flip = false }: { flip?: boolean }) {
  // Leaves along a circular arc from the base (bottom) up toward the crown.
  const leaves = [];
  const COUNT = 15;
  for (let i = 0; i < COUNT; i++) {
    const t = i / (COUNT - 1);
    // arc: start ~250° swing to ~30° (SVG angle space), radius 150 around (200,200)
    const angle = (250 - t * 215) * (Math.PI / 180);
    const r = 152;
    const x = 200 + r * Math.cos(angle);
    const y = 200 - r * Math.sin(angle);
    // leaf points outward along the tangent
    const rotate = -(250 - t * 215) + 90;
    const scale = 0.72 + 0.5 * Math.sin(Math.PI * (0.15 + 0.85 * t)); // small at base, full mid, tapering crown
    leaves.push(
      <g key={i} transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
        {/* leaf pair: one outward, one inward */}
        <path d="M0 0 Q 9 -14 0 -34 Q -9 -14 0 0 Z" fill="url(#leafGrad)" />
        <path d="M0 0 Q 12 10 30 6 Q 14 -6 0 0 Z" fill="url(#leafGrad)" opacity="0.85" />
      </g>
    );
  }
  return (
    <g transform={flip ? "scale(-1,1) translate(-400,0)" : undefined}>
      {/* stem along the same arc */}
      <path
        d="M 200 352 A 152 152 0 0 1 66 128"
        fill="none"
        stroke="url(#stemGrad)"
        strokeWidth="4"
        strokeLinecap="round"
        transform="rotate(14 200 200)"
      />
      {leaves}
    </g>
  );
}

export default function LaurelWreath({ size = "100%", className = "" }: Props) {
  return (
    <svg viewBox="0 0 400 400" width={size} height={size} className={className} aria-hidden>
      <defs>
        <linearGradient id="leafGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8cc7a" />
          <stop offset="55%" stopColor="#b9932f" />
          <stop offset="100%" stopColor="#6e5a1c" />
        </linearGradient>
        <linearGradient id="stemGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#caa845" />
          <stop offset="100%" stopColor="#7a6420" />
        </linearGradient>
      </defs>
      <Branch />
      <Branch flip />
      {/* crossed stems at the base */}
      <g stroke="url(#stemGrad)" strokeWidth="5" strokeLinecap="round">
        <line x1="182" y1="342" x2="230" y2="368" />
        <line x1="218" y1="342" x2="170" y2="368" />
      </g>
    </svg>
  );
}
