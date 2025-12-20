/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // LLM Provider colors
        chatgpt: {
          DEFAULT: '#10a37f',
          light: '#19c37d',
          dark: '#0d8a6a',
        },
        claude: {
          DEFAULT: '#d97706',
          light: '#f59e0b',
          dark: '#b45309',
        },
        gemini: {
          DEFAULT: '#4285f4',
          light: '#5a9cf5',
          dark: '#3367d6',
        },
      },
    },
  },
  plugins: [],
}
