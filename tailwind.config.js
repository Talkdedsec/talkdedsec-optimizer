/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 900: "#141414", 800: "#1a1a1a", 700: "#222222", 600: "#2a2a2a", 500: "#353535" },
        sun: { DEFAULT: "#FFD600", dim: "#c9a900" },
      },
      fontFamily: { sans: ['"Segoe UI Variable Text"', '"Segoe UI"', "system-ui", "sans-serif"] },
    },
  },
};
