import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        arctic: {
          50: '#f7fbff',
          100: '#edf6ff',
          200: '#d6e9ff',
          300: '#b7d8ff',
          400: '#8cbfff',
          500: '#609fff',
          600: '#467fef',
          700: '#375fcb',
          800: '#324ea4',
          900: '#2f447f',
        },
      },
    },
  },
} satisfies Config
