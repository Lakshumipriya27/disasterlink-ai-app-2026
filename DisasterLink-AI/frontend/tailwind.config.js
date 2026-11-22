/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'] },
      colors: {
        navy: { 50: '#f1f5fb', 100: '#e2e9f5', 600: '#1e3a6e', 700: '#172f5a', 800: '#12254a', 900: '#0b1a36' },
        canvas: '#f6f8fb',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)',
        lift: '0 4px 12px rgba(16,24,40,0.08)',
      },
    },
  },
  plugins: [],
}
