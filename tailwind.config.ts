import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        // Montserrat (display, comme le wordmark) + Figtree (UI) — chargées dans app/layout.tsx
        display: ["var(--font-montserrat)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-figtree)", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["var(--font-figtree)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Palette de marque (logo) — fixe, indépendante du thème
        ink: "hsl(var(--ink) / <alpha-value>)",
        navy: "hsl(var(--navy) / <alpha-value>)",
        deep: "hsl(var(--deep) / <alpha-value>)",
        teal: "hsl(var(--teal) / <alpha-value>)",
        pulse: {
          DEFAULT: "hsl(var(--pulse) / <alpha-value>)",
          soft: "hsl(var(--pulse-soft) / <alpha-value>)",
        },
        paper: {
          DEFAULT: "hsl(var(--paper) / <alpha-value>)",
          deep: "hsl(var(--paper-deep) / <alpha-value>)",
        },
        axia: {
          DEFAULT: "hsl(var(--axia) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          soft: "hsl(var(--warning-soft))",
        },
        critical: {
          DEFAULT: "hsl(var(--critical))",
          soft: "hsl(var(--critical-soft))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          soft: "hsl(var(--info-soft))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
          muted: "hsl(var(--sidebar-muted))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      backgroundImage: {
        // Dégradés du logo : encre → sarcelle → pouls
        "gradient-brand": "linear-gradient(120deg, hsl(var(--ink)) 0%, hsl(var(--deep)) 40%, hsl(var(--teal)) 70%, hsl(var(--pulse)) 100%)",
        "gradient-pulse": "linear-gradient(90deg, hsl(var(--teal)), hsl(var(--pulse)))",
        "gradient-axia": "linear-gradient(135deg, hsl(var(--pulse)) 0%, hsl(var(--teal)) 45%, hsl(var(--axia)) 100%)",
      },
      boxShadow: {
        // Ombres teintées d'encre, comme dans le design system
        soft: "0 1px 2px hsl(var(--ink) / 0.06), 0 4px 16px -6px hsl(var(--ink) / 0.12)",
        elevated: "0 2px 4px hsl(var(--ink) / 0.06), 0 24px 48px -16px hsl(var(--ink) / 0.22)",
        glow: "0 0 0 1px hsl(var(--pulse) / 0.4), 0 8px 32px -8px hsl(var(--pulse) / 0.55)",
      },
      keyframes: {
        "pulse-draw": {
          "0%": { strokeDashoffset: "1" },
          "55%": { strokeDashoffset: "0" },
          "100%": { strokeDashoffset: "-1" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          from: { opacity: "0", transform: "translateX(-12px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "pulse-draw": "pulse-draw 2.4s cubic-bezier(0.65, 0, 0.35, 1) infinite",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.4s ease-out",
        "slide-in-left": "slide-in-left 0.3s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
