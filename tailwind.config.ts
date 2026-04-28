import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0b0d10',
        panel: '#11151b',
        panel2: '#151a21',
        border: 'rgba(255,255,255,0.06)',
        primary: '#5B8CFF',
        success: '#17C964',
        danger: '#FF5D73',
        warning: '#F5A524',
        text: '#F8FAFC',
        muted: '#94A3B8'
      },
      boxShadow: {
        glow: '0 18px 50px rgba(91,140,255,0.18)',
        soft: '0 10px 30px rgba(0,0,0,0.24)'
      },
      borderRadius: {
        '2xl': '1.25rem'
      },
      fontFamily: {
        sans: ['Inter', 'Geist', 'Satoshi', 'ui-sans-serif', 'system-ui']
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' }
        }
      },
      animation: {
        marquee: 'marquee 28s linear infinite',
        shimmer: 'shimmer 1.4s linear infinite'
      }
    }
  },
  plugins: []
} satisfies Config;
