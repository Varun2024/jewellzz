/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // legacy names kept so existing utility classes still work
        surface: 'var(--paper)',
        panel: 'var(--paper-2)',
        border: 'var(--rule)',
        text: 'var(--ink-950)',
        muted: 'var(--ink-500)',
        accent: 'var(--gold-700)',
        success: 'var(--moss-600)',
        warn: 'var(--amber-500)',
        danger: 'var(--rose-500)',
        gold: 'var(--gold-500)',

        // new semantic names
        ink: {
          950: 'var(--ink-950)',
          700: 'var(--ink-700)',
          500: 'var(--ink-500)',
          300: 'var(--ink-300)',
        },
        paper: {
          DEFAULT: 'var(--paper)',
          2: 'var(--paper-2)',
          3: 'var(--paper-3)',
        },
        rule: {
          DEFAULT: 'var(--rule)',
          ink: 'var(--rule-ink)',
        },
      },
      fontFamily: {
        ui: ['var(--font-ui)'],
        sans: ['var(--font-ui)'],
        display: ['var(--font-display)'],
        serif: ['var(--font-display)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        DEFAULT: '4px',
        sm: '3px',
        md: '4px',
        lg: '6px',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
