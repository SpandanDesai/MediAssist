/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-alt": "rgb(var(--surface-alt) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        "ink-2": "rgb(var(--ink-2) / <alpha-value>)",
        rule: "rgb(var(--rule) / <alpha-value>)",
        brand: "rgb(var(--brand) / <alpha-value>)",
        "brand-strong": "rgb(var(--brand-strong) / <alpha-value>)",
        "brand-tint": "rgb(var(--brand-tint) / <alpha-value>)",
        "brand-fg": "rgb(var(--brand-fg) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        "danger-tint": "rgb(var(--danger-tint) / <alpha-value>)",
        "danger-fg": "rgb(var(--danger-fg) / <alpha-value>)",
        low: "rgb(var(--low) / <alpha-value>)",
        "low-tint": "rgb(var(--low-tint) / <alpha-value>)",
        med: "rgb(var(--med) / <alpha-value>)",
        "med-tint": "rgb(var(--med-tint) / <alpha-value>)",
        high: "rgb(var(--high) / <alpha-value>)",
        "high-tint": "rgb(var(--high-tint) / <alpha-value>)",
        emergency: "rgb(var(--emergency) / <alpha-value>)",
        "emergency-tint": "rgb(var(--emergency-tint) / <alpha-value>)",
      },
      fontFamily: {
        ui: ["Manrope", "Segoe UI", "system-ui", "sans-serif"],
        read: ['"Atkinson Hyperlegible"', "Manrope", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 37, 49, 0.06)",
        overlay: "0 10px 28px -18px rgba(13, 33, 48, 0.28)",
      },
      animation: {
        waveform: "waveform .9s ease-in-out infinite alternate",
      },
      keyframes: {
        waveform: {
          "0%": { transform: "scaleY(.25)" },
          "100%": { transform: "scaleY(1)" },
        },
      },
    },
  },
  plugins: [],
};
