const { tailwindPreset } = require('@sabjiilelo/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [tailwindPreset],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
};
