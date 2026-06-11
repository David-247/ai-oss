import type { Config } from "tailwindcss";

// REQ-CORE-003: responsive desktop/tablet/mobile layouts are delivered in
// Phase 05; this config is the budgeted foundation. Dark mode via class.
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
