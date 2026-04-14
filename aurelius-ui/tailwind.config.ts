// AURELIUS THEME — TAILWIND CONFIG
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aurelius: {
          black: "#000000",
          charcoal: "#0d0d0d",
          gold: "#d4af37",
          goldSoft: "#e8c766",
          whiteSoft: "#f5f5f5",
        },
      },
      backgroundImage: {
        wreath: "url('/wreath/aurelius-wreath.svg')",
      },
      boxShadow: {
        gold: "0 0 20px rgba(212, 175, 55, 0.25)",
      },
      borderColor: {
        gold: "#d4af37",
      },
    },
  },
  plugins: [],
};

export default config;
