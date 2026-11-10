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
        // Marca Mecanify: azul escuro (fundos e superfícies) + azul claro (acento).
        mecanify: {
          bg: '#071226',
          surface: '#0B1B36',
          card: '#12274D',
          border: '#264577',
          dark: '#1E3A8A',
          accent: '#38BDF8',
          accentHover: '#0EA5E9',
        },
        // Neutros com tom azul-marinho: os fundos/bordas/textos slate-* de todas as telas seguem a marca.
        slate: {
          50: '#F4F8FD', 100: '#E8EFFA', 200: '#D2DEF2', 300: '#B0C3E3', 400: '#86A0CC',
          500: '#5B7BB0', 600: '#3A5C90', 700: '#264577', 800: '#12274D', 900: '#0B1B36', 950: '#071226',
        },
      },
    },
  },
  plugins: [],
};

