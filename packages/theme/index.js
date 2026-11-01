// Brand tokens from THEME.md. Plain CommonJS so Tailwind config and Metro can both load it.
const colors = {
  primary: '#0e5a32',
  'dark-green': '#064420',
  'light-green': '#d9f2e0',
  beige: '#f5ebd7',
  cream: '#fbf6ea',
  accent: '#ff8a3d',
  leaf: '#4caf3d',
  ink: '#0b1a10',
  body: '#1c2a20',
  mint: '#eef6e6',
  deep: '#032a14',
  muted: '#6b7a70',
  line: '#e6dfcf',
  danger: '#d64545',
  warning: '#e8a317',
  whatsapp: '#25d366',
  white: '#ffffff',
};

const fonts = {
  sans: 'Poppins',
  script: 'Caveat',
};

const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };

const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

/** Tailwind preset for the web app. */
const tailwindPreset = {
  theme: {
    extend: {
      colors,
      fontFamily: {
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        script: ['Caveat', 'cursive'],
      },
      borderRadius: { xl: '16px', '2xl': '24px' },
      boxShadow: {
        card: '0 1px 2px rgba(11,26,16,0.04), 0 4px 16px rgba(11,26,16,0.06)',
        lift: '0 8px 30px rgba(14,90,50,0.18)',
      },
    },
  },
};

module.exports = { colors, fonts, radius, spacing, tailwindPreset };
