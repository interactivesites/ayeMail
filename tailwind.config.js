/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./renderer/**/*.{vue,js,ts,jsx,tsx}",
    "./node_modules/vue-tailwind-datepicker/**/*.js",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Albert Sans"', 'system-ui', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        // Vue Tailwind Datepicker theme colors
        'vtd-primary': {
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
        'vtd-secondary': {
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
          DEFAULT: '#4b4b4b',
          50: '#fafbfc',
          100: '#f5f6f7',
          200: '#e7e7e8',
          300: '#d0d1d2',
          400: '#b0b1b2',
          500: '#8a8b8c',
          600: '#6b6b6c',
          700: '#4b4b4b',
          800: '#2f3030',
          900: '#19191a',
          950: '#0d0d0e',
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

