// AURELIUS OS — BACKGROUND WREATH
// The mockup's field: the real crest artwork at field scale — weathered
// olive, slowly breathing — with the central letterform occluded so only
// the organic laurel ring reads behind the interface.
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
            src="/crest/aurelius-crest.png"
            alt=""
            className="w-full h-full object-contain"
            style={{ filter: "sepia(0.5) saturate(0.62) brightness(0.68)", opacity: 0.55 }}
          />
          {/* occlude the A — the field wants the ring, not the logo */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, #0a0a0a 0%, #0a0a0a 19%, rgba(10,10,10,0) 29%)",
            }}
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
