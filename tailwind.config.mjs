/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#08111f',
          900: '#101b2d',
          800: '#16243a',
          700: '#213555'
        },
        braga: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490'
        },
        limewash: '#d9f99d'
      },
      boxShadow: {
        glow: '0 0 80px rgba(34, 211, 238, 0.22)'
      }
    }
  },
  plugins: []
};
