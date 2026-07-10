// AURELIUS OS — BACKGROUND WREATH
// The field from the mockup: speckled black, soft center light, one big
// hand-drawn laurel (no letterform) breathing slowly behind everything.
import LaurelWreath from "../identity/LaurelWreath";

export default function BackgroundWreath() {
  return (
    <div aria-hidden className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* soft center lift so the black isn't flat */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 45%, rgba(46,40,26,0.55) 0%, rgba(10,10,10,0) 65%)",
        }}
      />
      {/* the laurel — big, weathered, breathing */}
      <div className="absolute inset-0 flex items-center justify-center animate-wreathBreathe opacity-[0.16]">
        <LaurelWreath size="105vmin" />
      </div>
      {/* grain */}
      <div className="absolute inset-0 aurelius-grain" />
      {/* vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 25%, rgba(0,0,0,0.72) 100%)",
        }}
      />
    </div>
  );
}
