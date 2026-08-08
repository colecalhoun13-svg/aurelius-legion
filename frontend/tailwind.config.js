module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Legacy aliases — kept during migration (REDESIGN_PLAN.md), pruned in P3.
        "aurelius-bg": "#0a0a0a",
        "aurelius-text": "#ededed",
        "aurelius-panel": "#111111",
        "aurelius-border": "#2a2a2a",
        "aurelius-gold": "#d4af37",
        // ELEVATED IMPERIAL tokens (docs/REDESIGN_PLAN.md)
        gold: {
          bright: "#f2d377",
          DEFAULT: "#d4af37",
          dim: "#8a6f22",
        },
        surface: { 0: "#0a0a0a", 1: "#14120c", 2: "#1b1811" },
        ink: { DEFAULT: "#f2f2ef", 2: "#b3ada0", 3: "#7a7466" },
        money: "#a8c39a",
        attn: "#d9a441",
        danger: "#c96b5a",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        body: ["var(--font-body)", "Georgia", "serif"],
        data: ["var(--font-data)", "Arial Narrow", "sans-serif"],
      },
      transitionTimingFunction: {
        stately: "cubic-bezier(.22,1,.36,1)",
      },
      backgroundImage: {
        wreath: "url('/crest/aurelius-crest.png')",
      },
    },
  },
  plugins: [],
};
