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
          DEFAULT: "#1763cf",
          light: "#3b82e0",
          dark: "#0f4aa6",
        },
        bulldog: {
          blue: "#1763cf",
          gray: "#aeb4bc",
        },
        lime: {
          accent: "#84cc16",
        },
      },
    },
  },
  plugins: [],
};
