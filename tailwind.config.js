/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./stores/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      'xs': '400px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        'terminal-black': '#0a0a0a',
        'terminal-dark': '#111111',
        'terminal-gray': '#1f1f1f',
        'terminal-darker': '#0d0d0d',
        'profit-green': '#00ff9d',
        'terminal-green': '#00ff9d',
        'loss-red': '#ff0055',
        'crypto-blue': '#3b82f6',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      }
    }
  },
  plugins: [],
}

