import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0F262B",
        ink2: "#153138",
        ink3: "#1C3D45",
        sand: "#F3ECDA",
        sand2: "#E9DDC0",
        coral: "#E2612F",
        coraldeep: "#A83D1D",
        sea: "#6E9C90",
        cream: "#FBF6EC",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        body: ["var(--font-worksans)", "sans-serif"],
      },
      letterSpacing: {
        widest2: "0.28em",
      },
    },
  },
  plugins: [],
};
export default config;
