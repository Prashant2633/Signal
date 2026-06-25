import type { Config } from "tailwindcss";

/**
 * Signal-inspired palette. Signal Desktop uses a deep navy dark theme and a
 * light theme with its signature blue (#2c6bed) accent. We expose both via CSS
 * variables (see globals.css) and map semantic names here.
 */
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        signal: {
          blue: "#2c6bed",
          bluedark: "#3a76f0",
        },
        // Semantic tokens resolved from CSS variables for light/dark theming.
        bg: "rgb(var(--bg) / <alpha-value>)",
        panel: "rgb(var(--panel) / <alpha-value>)",
        elevated: "rgb(var(--elevated) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        bubbleIn: "rgb(var(--bubble-in) / <alpha-value>)",
        bubbleOut: "rgb(var(--bubble-out) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.18s ease-out",
        "slide-up": "slide-up 0.22s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
