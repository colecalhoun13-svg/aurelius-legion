import type { MetadataRoute } from "next";

// PWA manifest — Aurelius installs on the phone like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aurelius OS",
    short_name: "Aurelius",
    description: "Operator-class second mind. Operate with discipline.",
    start_url: "/deck",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
