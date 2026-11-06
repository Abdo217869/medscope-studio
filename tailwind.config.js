/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fbf8ea',
          100: '#f5eecc',
          200: '#eddca0',
          300: '#e3c46e',
          400: '#dbaa43',
          500: '#cc8e26',
          600: '#b06f1d',
          700: '#8c501a',
          800: '#73411a',
          900: '#60361a',
        }
      },
      fontFamily: {
        script: ['Caveat', 'cursive'],
        heading: ['Montserrat', 'sans-serif'],
        sans: ['Inter', 'sans-serif']
      }
    },
  },
  plugins: [],
}

