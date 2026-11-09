/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "SF Pro Display", "SF Pro Text", "Segoe UI Variable Display", "Segoe UI", "Inter", "system-ui", "sans-serif"],
      },
      transitionTimingFunction: { apple: "cubic-bezier(.22,1,.36,1)" },
      transitionDuration: { 250: "250ms" },
    },
  },
};
