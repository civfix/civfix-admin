import type { Config } from "tailwindcss"
import { tokens } from "@civfix/shared/tokens"

/**
 * Tailwind theme derived entirely from the shared design tokens.
 *
 * The admin dashboard's *visual* source of truth is the ported design stylesheet
 * (src/styles/admin.css + src/styles/colors-and-type.css), which owns the warm-paper CSS custom
 * properties (--bloom, --ink, --paper, --cat-*, ...) and every component class (.card, .stile,
 * .qrow, .btn, ...). Tailwind here is available for incidental LAYOUT utilities only; it never needs
 * to redefine those component classes. To keep the civfix rule "never hardcode a hex the design
 * system covers", this config maps every shared token scale into Tailwind exactly like community-web,
 * so any utility we do reach for (bg-paper, text-ink3, rounded-lg, shadow-s2, font-display, ...) draws
 * from the same single source of truth the design CSS does.
 */

const { color, font, fontSize, radius, shadow, space } = tokens

/** Convert the numeric token radius/space values to px strings Tailwind expects. */
const px = (n: number): string => `${n}px`

const config: Config = {
  // Class-based dark mode is left available but the warm palette is light-first.
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: px(space["4"]),
    },
    extend: {
      colors: {
        // ----- raw token scales (the warm civfix palette) -----
        bloom: color.bloom,
        moss: color.moss,
        sun: color.sun,
        sky: color.sky,
        lilac: color.lilac,

        // Brand single-stop accents.
        brand: color.brand,

        // Neutral / paper system. These are the names app code uses most:
        // bg-paper, bg-paper2, bg-cardflat, text-ink, text-ink2..ink5.
        paper: color.neutral.paper,
        paper2: color.neutral.paper2,
        cardflat: color.neutral.card,
        cardTint: color.neutral.cardTint,
        ink: {
          DEFAULT: color.neutral.ink,
          2: color.neutral.ink2,
          3: color.neutral.ink3,
          4: color.neutral.ink4,
          5: color.neutral.ink5,
        },

        // Report category colors (text-cat-trash, bg-cat-graffiti, ...).
        cat: color.category,

        // Cleanup/event accent (sun-dark).
        cleanup: color.cleanup,
      },

      fontFamily: {
        display: [font.display, "ui-sans-serif", "system-ui", "sans-serif"],
        body: [font.body, "ui-sans-serif", "system-ui", "sans-serif"],
        sans: [font.body, "ui-sans-serif", "system-ui", "sans-serif"],
        mono: [font.mono, "ui-monospace", "SFMono-Regular", "monospace"],
      },

      // Token font sizes exposed as text-token-12 .. text-token-64 so the default Tailwind type
      // scale (text-sm, text-lg, ...) stays usable alongside the exact token ramp.
      fontSize: Object.fromEntries(
        Object.entries(fontSize).map(([k, v]) => [`token-${k}`, v]),
      ),

      lineHeight: {
        tight: String(tokens.lineHeight.tight),
        snug: String(tokens.lineHeight.snug),
        base: String(tokens.lineHeight.base),
        loose: String(tokens.lineHeight.loose),
      },

      letterSpacing: {
        tightest: tokens.tracking.tight,
        snugger: tokens.tracking.snug,
        wider: tokens.tracking.wide,
      },

      // Token spacing exposed as p-token-4, gap-token-6, etc. (4,8,12,16,20,24,32,40,48,64 px).
      spacing: Object.fromEntries(
        Object.entries(space).map(([k, v]) => [`token-${k}`, px(v)]),
      ),

      borderRadius: {
        lg: px(radius.lg), // 20
        xl: px(radius.xl), // 28
        "2xl": px(radius["2xl"]), // 36
        md: px(radius.md), // 14
        sm: px(radius.sm), // 10
        xs: px(radius.xs), // 6
        pill: px(radius.pill),
      },

      boxShadow: {
        s1: shadow.s1,
        s2: shadow.s2,
        s3: shadow.s3,
        s4: shadow.s4,
        pin: shadow.pin,
        sheen: shadow.sheenTop,
        ring: shadow.ring,
      },

      transitionTimingFunction: {
        out: tokens.motion.ease.out,
        spring: tokens.motion.ease.spring,
        "in-out": tokens.motion.ease.inOut,
      },

      transitionDuration: {
        d1: String(tokens.motion.dur.d1),
        d2: String(tokens.motion.dur.d2),
        d3: String(tokens.motion.dur.d3),
        d4: String(tokens.motion.dur.d4),
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
