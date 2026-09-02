/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        carbon: {
          950: "#08090b",
          900: "#0c0e11",
          850: "#111318",
          800: "#15181e",
          700: "#1b1f27",
          600: "#242933",
          500: "#2f3542",
          400: "#4a5162",
          300: "#6b7280",
          200: "#9ca3af",
          100: "#d1d5db",
        },
        brand: {
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          glow: "#22d3ee",
        },
        amber: {
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgb(0 0 0 / 0.4), 0 1px 3px 0 rgb(0 0 0 / 0.3)",
        elevated: "0 4px 16px -4px rgb(0 0 0 / 0.5), 0 2px 6px -2px rgb(0 0 0 / 0.4)",
        glow: "0 0 0 1px rgb(56 189 248 / 0.15), 0 0 24px -4px rgb(56 189 248 / 0.25)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
        "scale-in": "scale-in 0.15s ease-out",
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};
