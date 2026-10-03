/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dbe6fe',
          200: '#bfd3fe',
          300: '#93b4fd',
          400: '#6090fa',
          500: '#3b6cf6',
          600: '#2550eb',
          700: '#1d3fd8',
          800: '#1e35af',
          900: '#1e328a',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f7f8fa',
          sunken: '#eff1f5',
          border: '#e3e6ec',
        },
        ink: {
          DEFAULT: '#1a1d26',
          muted: '#5b6273',
          subtle: '#8b91a1',
        },
        priority: {
          urgent: '#e5484d',
          high: '#f76b15',
          normal: '#3b6cf6',
          low: '#8b91a1',
          none: '#c4c9d4',
        },
        category: {
          todo: '#8b91a1',
          in_progress: '#f5a524',
          done: '#30a46c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        card: '0.625rem',
        pill: '9999px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.08)',
        lift: '0 8px 24px rgba(16, 24, 40, 0.14), 0 2px 6px rgba(16, 24, 40, 0.08)',
        drawer: '-12px 0 32px rgba(16, 24, 40, 0.12)',
      },
      keyframes: {
        'slide-in': { from: { transform: 'translateY(8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
      },
      animation: {
        'slide-in': 'slide-in 160ms ease-out',
      },
    },
  },
  plugins: [],
};
