/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#090d16',
          900: '#0d131f',
          850: '#111927',
          800: '#162032',
          700: '#1e293b',
          600: '#334155',
          500: '#475569',
        },
        trade: {
          green: '#10b981',
          'green-dark': '#059669',
          'green-glow': 'rgba(16, 185, 129, 0.2)',
          red: '#ef4444',
          'red-dark': '#dc2626',
          'red-glow': 'rgba(239, 68, 68, 0.2)',
          accent: '#3b82f6',
          purple: '#8b5cf6',
          gold: '#f59e0b',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
