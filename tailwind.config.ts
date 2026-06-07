import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sketch: ["var(--font-sketch)", "cursive", "sans-serif"],
      },
      animation: {
        "draw-line": "draw 1.5s ease-in-out forwards",
        "dash-march": "dashMarch 2s linear infinite",
      },
      keyframes: {
        draw: {
          "0%": { strokeDashoffset: "var(--dash-length, 1000)" },
          "100%": { strokeDashoffset: "0" },
        },
        dashMarch: {
          "0%": { strokeDashoffset: "1000" },
          "100%": { strokeDashoffset: "0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
