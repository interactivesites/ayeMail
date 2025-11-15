/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./renderer/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Albert Sans"', 'system-ui', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

