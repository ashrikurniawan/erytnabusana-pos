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
        brand: {
          50: "#fdf4f5",
          100: "#fbe8ea",
          200: "#f7d5d9",
          500: "#d93856",
          600: "#c02643",
          700: "#a11d35",
          800: "#861b2f",
          900: "#701a2b",
        },
      },
    },
  },
  plugins: [],
};

export default config;
