module.exports = {
  content: ["./src/routes/**/*.{html,svelte,js,ts}"],
  plugins: [require("@tailwindcss/typography"), require("daisyui")],
  daisyui: {
    themes: [
      {
        sois: {
          primary: "#ff7598",
          secondary: "#75d1f0",
          accent: "#c07eec",
          neutral: "#423f00",
          "base-100": "#ffee00",
          info: "#3abff8",
          success: "#36d399",
          warning: "#fbbd23",
          error: "#f87272",
        },
      },
    ],
  },
};
