/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./renderer/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Albert Sans"', 'system-ui', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#c2410c',
          600: '#9a3412',
          700: '#7c2d12',
          800: '#6b1d1d',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        secondary: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#991b1b',
          600: '#7f1d1d',
          700: '#6b1d1d',
          800: '#450a0a',
          900: '#2d0a0a',
          950: '#1a0505',
        },
        'dark-gray': {
          DEFAULT: '#374151',
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#030712',
        },
      },
      backgroundColor: {
        DEFAULT: '#ffffff',
      },
      textColor: {
        DEFAULT: '#374151', // dark-gray-700
      },
    },
  },
  plugins: [],
}

