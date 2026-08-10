import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#2A1D16", // warm near-black for headings
        body: "#6B5D53", // muted warm gray for body/secondary text
        paper: "#FDF8F1", // page background, warm ivory
        card: "#FFFFFF",
        line: "#F1E4D4", // hairline borders
        peach: "#FCE2D3", // split-panel / soft accent background
        brand: {
          50: "#FDF1E9",
          100: "#FBE1CE",
          200: "#F6C5A3",
          300: "#EEA377",
          400: "#D9824F",
          500: "#C1633D", // primary terracotta
          600: "#A84F31",
          700: "#8A3F27",
          800: "#6B3120",
          900: "#4A2216",
        },
        success: {
          bg: "#E4F1E1",
          text: "#3E7A3F",
          border: "#CBE5C6",
        },
        warning: {
          bg: "#FBE7CF",
          text: "#B06A26",
          border: "#F3D4A9",
        },
        danger: {
          bg: "#FBE2E1",
          text: "#C1493F",
          border: "#F3C7C3",
        },
      },
      fontFamily: {
        display: ["var(--font-playfair)", "serif"],
        body: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "monospace"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(42,29,22,0.04), 0 8px 24px rgba(193,99,61,0.06)",
      },
    },
  },
  plugins: [],
};
export default config;

