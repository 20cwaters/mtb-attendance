/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        slate: {
          850: "#172033",
          950: "#0b1120",
        },
        accent: {
          DEFAULT: "#f97316",
          light: "#fb923c",
          dark: "#ea580c",
        },
        lime: {
          accent: "#84cc16",
        },
      },
    },
  },
  plugins: [],
};
