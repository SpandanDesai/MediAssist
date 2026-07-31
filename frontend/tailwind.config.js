/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 16px 45px -22px rgba(15, 23, 42, 0.28)",
        glow: "0 15px 35px -15px rgba(14, 165, 233, 0.55)",
      },
      animation: {
        "fade-up": "fade-up .5s ease-out both",
        "pulse-soft": "pulse-soft 2.2s ease-in-out infinite",
        waveform: "waveform .9s ease-in-out infinite alternate",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: ".72", transform: "scale(.98)" },
        },
        waveform: {
          "0%": { transform: "scaleY(.25)" },
          "100%": { transform: "scaleY(1)" },
        },
      },
    },
  },
  plugins: [],
};
