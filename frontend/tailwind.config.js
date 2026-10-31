/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif"
        ]
      },
      colors: {
        brand: {
          50: "#f5f7ff",
          100: "#e9edff",
          500: "#4f46e5",
          600: "#4338ca",
          700: "#3730a3"
        }
      },
      boxShadow: {
        soft: "0 4px 24px rgba(0, 0, 0, 0.06)"
      }
    }
  },
  plugins: []
};