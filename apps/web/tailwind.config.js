module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          100: '#fcc1b5',
          200: '#f7bbad',
          300: '#fab2a2',
          400: '#db8c75',
          500: '#f5886f',
          600: '#dc7558',
          900: '#7a3320',
        },
        secondary: '#1e1035',
        tertiary: '#632650',
        player: {
          1: '#a7455a',
          2: '#f9b357',
          // 2: '#f9f871',
        },
      },
    },
  },
  plugins: [],
};
