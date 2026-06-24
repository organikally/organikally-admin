/** @type {import('tailwindcss').Config} */

// Brand palette via CSS vars so Tailwind opacity utilities work:
// rgb(var(--x) / <alpha-value>). Single source of truth lives in index.css :root.
const c = (v) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ---- Brand DNA (spec §1) ----
        paper: c('--paper'),
        surface: c('--surface'),
        yellow: {
          DEFAULT: c('--yellow'),
          deep: c('--yellow-deep'),
        },
        'gold-ink': c('--gold-ink'),
        ink: {
          DEFAULT: c('--ink'),
          muted: c('--ink-muted'),
          faint: c('--ink-faint'),
        },
        line: c('--line'),
        // ---- Semantic status ----
        success: c('--success'),
        warning: c('--warning'),
        danger: c('--danger'),
        info: c('--info'),

        // ---- Backward-compat aliases (remapped to the brand palette so every
        // existing screen keeps compiling and renders on-brand). Do not add new
        // usages of these; prefer the tokens above. ----
        brand: c('--success'), // was forest-green primary -> now status green
        green: c('--success'),
        accent: c('--yellow'), // was gold -> oil-gold accent
        gold: c('--yellow'),
        'gold-bright': c('--yellow-deep'),
        mustard: c('--yellow'),
        forest: c('--success'),
        cream: c('--paper'),
        charcoal: c('--ink'),
        muted: c('--ink-faint'),
        'surface-2': c('--surface'),
      },
      fontFamily: {
        display: ['"Chelsea Market"', 'Georgia', 'serif'],
        sans: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        deva: ['"Tiro Devanagari Hindi"', 'serif'],
        // legacy alias: screens using font-serif get the display face
        serif: ['"Chelsea Market"', 'Georgia', 'serif'],
      },
      borderRadius: {
        chip: '0.625rem', // inputs, selects, badges, small controls
        card: '1rem', // cards, panels, sheets, modals
        pill: '9999px', // buttons + status pills
      },
      boxShadow: {
        sm: '0 1px 2px rgba(31,27,18,.06)',
        md: '0 8px 24px -10px rgba(31,27,18,.14)',
        lg: '0 24px 60px -24px rgba(31,27,18,.22)',
        oil: 'inset 0 1px 0 rgba(255,255,255,.5), 0 10px 24px -14px rgba(206,150,10,.7)',
        // legacy aliases
        card: '0 1px 2px rgba(31,27,18,.06)',
        pop: '0 8px 24px -10px rgba(31,27,18,.14)',
      },
      transitionTimingFunction: {
        brand: 'cubic-bezier(.16,1,.3,1)',
      },
      keyframes: {
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'toast-in': 'toast-in .3s cubic-bezier(.16,1,.3,1)',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};
