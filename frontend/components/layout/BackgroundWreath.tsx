// AURELIUS OS — BACKGROUND WREATH
// The mockup's signature field: speckled black, a soft center light,
// a big weathered olive-gold wreath, vignette at the edges.
export default function BackgroundWreath() {
  return (
    <div aria-hidden className="fixed inset-0 pointer-events-none z-0">
      {/* soft center lift so the black isn't flat */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 42%, rgba(48,42,28,0.5) 0%, rgba(10,10,10,0) 65%)",
        }}
      />
      {/* the wreath — big, weathered, present */}
      <div className="absolute inset-0 bg-wreath bg-no-repeat bg-[length:88vmin] bg-[center_58%] aurelius-wreath-watermark" />
      {/* grain */}
      <div className="absolute inset-0 aurelius-grain" />
      {/* vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 25%, rgba(0,0,0,0.7) 100%)",
        }}
      />
    </div>
  );
}
