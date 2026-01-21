import type { Config } from 'tailwindcss';

/**
 * Tailwind CSS v4 Configuration
 *
 * Note: Tailwind v4 uses CSS-based configuration via @theme blocks in globals.css.
 * This file provides TypeScript types and content path configuration.
 * Custom theme colors are defined in src/app/globals.css using @theme.
 */
const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // WC2026 Theme Colors (also defined in globals.css @theme for v4 compatibility)
        primary: {
          DEFAULT: '#1a365d',
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1a365d',
          900: '#1e3a5f',
          950: '#172554',
        },
        secondary: {
          DEFAULT: '#2d3748',
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#2d3748',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        accent: {
          DEFAULT: '#38a169',
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#38a169',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
      },
    },
  },
  plugins: [],
};

export default config;
