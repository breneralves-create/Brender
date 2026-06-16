import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base: 'var(--bg-base)',
        'bg-base': 'var(--bg-base)',
        sidebar: 'var(--bg-sidebar)',
        'bg-sidebar': 'var(--bg-sidebar)',
        card: 'var(--bg-card)',
        'bg-card': 'var(--bg-card)',
        'border-card': 'var(--border-card)',
        primary: 'var(--primary)',
        'primary-hover': 'var(--primary-hover)',
        'primary-light': 'var(--primary-light)',
        'text-main': 'var(--text-main)',
        'text-muted': 'var(--text-muted)',
        hot: 'var(--hot)',
        'hot-light': 'var(--hot-light)',
        warm: 'var(--warm)',
        'warm-light': 'var(--warm-light)',
        cold: 'var(--cold)',
        'cold-light': 'var(--cold-light)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        error: 'var(--error)',
        'sidebar-active': 'var(--sidebar-active)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Space Grotesk', 'sans-serif'],
      },
      borderRadius: {
        'card': '12px',
        'input': '8px',
        'button': '8px',
        'badge': '999px',
        'modal': '16px',
      },
      boxShadow: {
        'card': 'var(--shadow-card)',
        'modal': 'var(--shadow-modal)',
        'dropdown': 'var(--shadow-dropdown)',
      }
    },
  },
  plugins: [],
} satisfies Config
