/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [  './src/**/*.{js,jsx,ts,tsx}',],
  theme: {
    extend: {
      backgroundColor: {
        "backgrounds-0": '#0B0C13',
        "backgrounds-100": 'rgb(17, 19, 27)',
        "backgrounds-200": '#181D25',
        "blue-1": "#0056FF"
      },
      textColor: {
        "fontColor-0": "#fff"
      }
    },
  },
  plugins: [],
}

