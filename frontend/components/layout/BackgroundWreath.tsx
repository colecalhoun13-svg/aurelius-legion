// AURELIUS OS — BACKGROUND WREATH
// The field: the laurel ring at field scale, weathered olive, slowly
// breathing behind the interface. Drawn in SVG (components/identity/
// WreathSVG) — the same geometry the startup assembles, crisp at any size.
import WreathSVG from "../identity/WreathSVG";

export default function BackgroundWreath() {
  return (
    <div aria-hidden className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* soft center lift so the black isn't flat */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 45%, rgba(46,40,26,0.5) 0%, rgba(10,10,10,0) 65%)",
        }}
      />
      {/* the laurel ring — same SVG crest as the startup, so the boot sequence
          settles onto EXACTLY this geometry (and no pixels at field scale) */}
      <div className="absolute inset-0 flex items-center justify-center animate-wreathBreathe">
        <div className="relative" style={{ width: "108vmin", height: "108vmin", opacity: 0.35 }}>
          <WreathSVG variant="olive" className="w-full h-full" />
        </div>
      </div>
      {/* grain */}
      <div className="absolute inset-0 aurelius-grain" />
      {/* vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)",
        }}
      />
    </div>
  );
}
