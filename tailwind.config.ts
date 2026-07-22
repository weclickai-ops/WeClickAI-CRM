import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        charcoal: {
          DEFAULT: "var(--charcoal)",
          soft: "var(--charcoal-soft)",
          line: "var(--charcoal-line)",
        },
        copper: {
          DEFAULT: "var(--copper)",
          hover: "var(--copper-hover)",
          soft: "var(--copper-soft)",
        },
        paper: "var(--paper)",
        surface: "var(--surface)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
        ok: "var(--ok)",
        warn: "var(--warn)",
        bad: "var(--bad)",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: { xl2: "14px" },
      boxShadow: {
        card: "0 1px 2px rgba(20,20,25,0.04), 0 4px 16px rgba(20,20,25,0.05)",
      },
    },
  },
  plugins: [],
};
export default config;
