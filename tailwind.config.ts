import type { Config } from 'tailwindcss';

// Los colores viven como variables CSS en src/index.css (claro y oscuro).
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        'surface-2': v('surface-2'),
        line: v('line'),
        ink: v('ink'),
        'ink-2': v('ink-2'),
        'ink-3': v('ink-3'),
        accent: v('accent'),
        'accent-ink': v('accent-ink'),
        'accent-soft': v('accent-soft'),
        positive: v('positive'),
        warn: v('warn'),
        danger: v('danger'),
        'danger-soft': v('danger-soft'),
      },
      borderRadius: {
        xl: '14px',
        '2xl': '20px',
        '3xl': '28px',
      },
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow) / 0.06), 0 8px 24px -12px rgb(var(--shadow) / 0.18)',
        lift: '0 2px 6px rgb(var(--shadow) / 0.08), 0 18px 40px -16px rgb(var(--shadow) / 0.35)',
        accent: '0 10px 30px -10px rgb(var(--accent) / 0.65)',
      },
      fontSize: {
        display: ['3rem', { lineHeight: '1', letterSpacing: '-0.035em', fontWeight: '650' }],
        hero: ['2.25rem', { lineHeight: '1.05', letterSpacing: '-0.03em', fontWeight: '650' }],
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'sheet-in': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'rise-in': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        pulse_ring: {
          '0%': { boxShadow: '0 0 0 0 rgb(var(--accent) / 0.45)' },
          '70%': { boxShadow: '0 0 0 14px rgb(var(--accent) / 0)' },
          '100%': { boxShadow: '0 0 0 0 rgb(var(--accent) / 0)' },
        },
      },
      animation: {
        'sheet-in': 'sheet-in 320ms cubic-bezier(0.22, 1, 0.36, 1)',
        'fade-in': 'fade-in 200ms ease-out',
        'rise-in': 'rise-in 280ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'pulse-ring': 'pulse_ring 2.2s ease-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
