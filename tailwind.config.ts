import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#0E0F14",
          deep: "#0C0D11",
          panel: "#14161C",
          elevated: "#1A1D25",
        },
        border: {
          DEFAULT: "#262A33",
          strong: "#343945",
        },
        text: {
          primary: "#E9EBEF",
          secondary: "#9BA1AD",
          dim: "#6A7180",
        },
        accent: {
          cyan: "#5B8DEF",
          green: "#46B98C",
          amber: "#D9A13B",
          red: "#E0565E",
        },
        diff: {
          easy: "#46B98C",
          medium: "#D9A13B",
          hard: "#E0565E",
        },
      },
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      borderRadius: {
        none: "0",
        sm: "6px",
        DEFAULT: "8px",
        md: "10px",
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        hard: "0 1px 2px 0 rgba(0,0,0,0.5)",
        soft: "0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -8px rgba(0,0,0,0.5)",
        glow: "0 0 0 3px rgba(91,141,239,0.18)",
        "glow-green": "0 0 0 3px rgba(70,185,140,0.18)",
      },
      keyframes: {
        "cursor-blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "rise-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        blink: "cursor-blink 1s step-end infinite",
        "slide-in": "slide-in 120ms ease-out",
        "rise-in": "rise-in 500ms cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
