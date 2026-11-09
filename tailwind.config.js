/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      colors: {
        autotec: {
          bg: '#0B0F17',
          surface: '#111827',
          card: '#1E293B',
          border: '#334155',
          orange: '#F97316',
          orangeHover: '#EA580C',
          blue: '#1E3A8A',
          blueLight: '#2563EB',
        },
      },
    },
  },
  plugins: [],
};

