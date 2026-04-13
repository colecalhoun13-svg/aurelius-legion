// ===============================================
// AURELIUS OS 3.4 — FULL CREST COMPONENT
// Uses your exact PNG crest asset.
// ===============================================

import Image from "next/image";

export default function AureliusCrest({ size = 120 }: { size?: number }) {
  return (
    <Image
      src="/crest/aurelius-crest.png"
      alt="Aurelius Crest"
      width={size}
      height={size}
      priority
      className="select-none pointer-events-none"
    />
  );
}
