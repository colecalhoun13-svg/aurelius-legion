// AURELIUS OS — BACKGROUND WREATH
// The mockup's field: the crest artwork with the letterform removed from
// the image itself (aurelius-wreath.png) — the pure laurel ring at field
// scale, weathered olive, slowly breathing behind the interface.
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
            style={{ filter: "sepia(0.5) saturate(0.62) brightness(0.68)", opacity: 0.55 }}
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
