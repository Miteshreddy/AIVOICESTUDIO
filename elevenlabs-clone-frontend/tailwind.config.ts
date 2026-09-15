import { type Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

export default {
  darkMode: "class",
  content: ["./src/**/*.tsx"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", ...fontFamily.sans],
      },
      colors: {
        studio: {
          950: "#07080d",
          900: "#0a0c14",
          850: "#0f1322",
          800: "#151a2e",
          700: "#1e2540",
          600: "#2d375d",
        },
        kaiz: {
          purple: "#8b5cf6",
          indigo: "#6366f1",
          cyan: "#06b6d4",
          pink: "#ec4899",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
