import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        chess: {
          dark: "#1e293b",
          darker: "#0f172a",
          boardLight: "#f0d9b5",
          boardDark: "#b58863",
          accent: "#38bdf8",
          emerald: "#10b981",
          gold: "#f59e0b",
          ruby: "#ef4444"
        }
      }
    },
  },
  plugins: [],
};
export default config;

