// AURELIUS OS — BACKGROUND WREATH
// The mockup's signature: a giant, faint gold wreath watermark centered
// behind everything, with a soft vignette so panels sit in darkness.
export default function BackgroundWreath() {
  return (
    <div aria-hidden className="fixed inset-0 pointer-events-none z-0">
      {/* giant centered wreath, barely-there gold */}
      <div className="absolute inset-0 bg-wreath bg-center bg-no-repeat bg-[length:75vmin] opacity-[0.06]" />
      {/* vignette — darkens edges like the mockup's textured black */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </div>
  );
}
