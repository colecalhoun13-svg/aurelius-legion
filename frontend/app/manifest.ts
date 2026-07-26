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
    // Long-press the icon → straight to the daily verbs.
    shortcuts: [
      { name: "Capture a thought", url: "/deck?capture=1" },
      { name: "The Bridge", url: "/bridge" },
      { name: "Ask the brain", url: "/corpus" },
    ],
    // Share an article/link from ANY app → it lands in the second brain.
    // (share_target is a valid manifest member; Next's Manifest type lags it.)
    ...({
      share_target: {
        action: "/share",
        method: "GET",
        params: { title: "title", text: "text", url: "url" },
      },
    } as any),
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
