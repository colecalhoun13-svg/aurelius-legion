// AURELIUS OS — BACKGROUND WREATH
// The field: the real crest artwork (aurelius-wreath.png — the laurel ring with
// the letterform removed), weathered olive, slowly breathing behind the
// interface. The actual asset, not a redraw.
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
      {/* the laurel ring */}
      <div className="absolute inset-0 flex items-center justify-center animate-wreathBreathe">
        <div className="relative" style={{ width: "108vmin", height: "108vmin" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/crest/aurelius-wreath.png"
            alt=""
            className="w-full h-full object-contain"
            style={{ filter: "sepia(0.5) saturate(0.6) brightness(0.55)", opacity: 0.35 }}
          />
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
