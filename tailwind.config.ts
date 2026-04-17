import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#0A0E1A",
          deep: "#05070D",
          panel: "#0D121F",
          elevated: "#111828",
        },
        border: {
          DEFAULT: "#1A2030",
          strong: "#262F44",
        },
        text: {
          primary: "#E8ECF1",
          secondary: "#8B95A7",
          dim: "#5A6679",
        },
        accent: {
          cyan: "#00E5FF",
          green: "#00FF88",
          amber: "#FFB800",
          red: "#FF3355",
        },
        diff: {
          easy: "#00FF88",
          medium: "#FFB800",
          hard: "#FF3355",
        },
      },
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        none: "0",
        sm: "2px",
        DEFAULT: "3px",
        md: "4px",
      },
      boxShadow: {
        hard: "0 2px 0 0 rgba(0,0,0,0.6)",
        glow: "inset 0 0 0 1px rgba(0,229,255,0.25), 0 0 0 1px rgba(0,229,255,0.15)",
        "glow-green":
          "inset 0 0 0 1px rgba(0,255,136,0.25), 0 0 0 1px rgba(0,255,136,0.15)",
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
      },
      animation: {
        blink: "cursor-blink 1s step-end infinite",
        "slide-in": "slide-in 120ms ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
