/** @type {import('tailwindcss').Config} */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export default {
  content: [path.join(__dirname, 'src/renderer/**/*.{ts,tsx,html,js,jsx}'), path.join(__dirname, 'src/renderer/**/*.{ts,tsx}')],
  theme: {
    extend: {
      colors: {
        cluster: {
          bg: '#0a0a0d',
          surface: '#111113',
          panel: '#18181b',
          elevated: '#1c1c1f',
          border: '#232326',
          borderStrong: '#2a2a2e',
          text: '#fafafa',
          muted: '#a1a1aa',
          dim: '#71717a',
          accent: '#00d9a5',
          accentHover: '#00c295',
          warning: '#f59e0b',
          error: '#ef4444',
          info: '#38bdf8',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Geist Mono', 'Menlo', 'monospace'],
        sans: ['Inter', 'Geist Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        cluster: '0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
      },
    },
  },
  plugins: [],
};
