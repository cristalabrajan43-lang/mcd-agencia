/**
 * Tailwind CSS Configuration for MCD-Agencia
 *
 * Custom theme based on brand guidelines:
 * - Base: Black (#000000)
 * - Accents: CMYK colors (Cyan, Magenta, Yellow)
 * - Contrast: White for legibility
 */

import type { Config } from 'tailwindcss';

const config: Config = {
  // ===========================================================================
  // Content Paths
  // ===========================================================================
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],

  // ===========================================================================
  // Theme Configuration
  // ===========================================================================
  theme: {
    extend: {
      // -----------------------------------------------------------------------
      // Brand Colors
      // -----------------------------------------------------------------------
      colors: {
        // CMYK colors for landing page
        cmyk: {
          cyan: '#0DA3EF',
          magenta: '#EC2D8D',
          yellow: '#FFE884',
          black: '#141414',
        },
        base: {
          black: '#141414',
          white: '#FFFFFF',
        },
        // Primary brand colors (CMYK inspired)
        brand: {
          cyan: '#00FFFF',
          magenta: '#FF00FF',
          yellow: '#FFFF00',
          black: '#000000',
        },
        // Primary color scheme
        primary: {
          50: '#f0feff',
          100: '#ccfbff',
          200: '#99f6ff',
          300: '#66f0ff',
          400: '#33ebff',
          500: '#0DD9E8', // Updated to match cmyk.cyan
          600: '#0BC5D3',
          700: '#0AB1BE',
          800: '#006666',
          900: '#003333',
          950: '#001919',
        },
        // Secondary (Magenta)
        secondary: {
          50: '#fff0ff',
          100: '#ffccff',
          200: '#ff99ff',
          300: '#ff66ff',
          400: '#ff33ff',
          500: '#FF00FF', // Magenta
          600: '#cc00cc',
          700: '#990099',
          800: '#660066',
          900: '#330033',
          950: '#190019',
        },
        // Accent (Yellow)
        accent: {
          50: '#fffff0',
          100: '#ffffcc',
          200: '#ffff99',
          300: '#ffff66',
          400: '#ffff33',
          500: '#FFFF00', // Yellow
          600: '#cccc00',
          700: '#999900',
          800: '#666600',
          900: '#333300',
          950: '#191900',
        },
        // Neutral (Dark theme base)
        neutral: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },
      },

      // -----------------------------------------------------------------------
      // Typography
      // -----------------------------------------------------------------------
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-montserrat)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-fira-code)', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.75rem' }],
      },

      // -----------------------------------------------------------------------
      // Spacing
      // -----------------------------------------------------------------------
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },

      // -----------------------------------------------------------------------
      // Border Radius
      // -----------------------------------------------------------------------
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },

      // -----------------------------------------------------------------------
      // Box Shadow
      // -----------------------------------------------------------------------
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(0, 255, 255, 0.3)',
        'glow-magenta': '0 0 20px rgba(255, 0, 255, 0.3)',
        'glow-yellow': '0 0 20px rgba(255, 255, 0, 0.3)',
        'inner-glow': 'inset 0 0 20px rgba(0, 255, 255, 0.1)',
      },

      // -----------------------------------------------------------------------
      // Background Image
      // -----------------------------------------------------------------------
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-cmyk':
          'linear-gradient(135deg, rgba(0, 255, 255, 0.2), rgba(255, 0, 255, 0.2), rgba(255, 255, 0, 0.2))',
      },

      // -----------------------------------------------------------------------
      // Animation
      // -----------------------------------------------------------------------
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'fade-in-up': 'fadeInUp 0.5s ease-out',
        'fade-in-down': 'fadeInDown 0.5s ease-out',
        'slide-in-right': 'slideInRight 0.5s ease-out',
        'slide-in-left': 'slideInLeft 0.5s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'gradient-shift': 'gradientShift 5s ease infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(0, 255, 255, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(0, 255, 255, 0.5)' },
        },
        gradientShift: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
      },

      // -----------------------------------------------------------------------
      // Z-Index
      // -----------------------------------------------------------------------
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },

      // -----------------------------------------------------------------------
      // Screen Breakpoints
      // -----------------------------------------------------------------------
      screens: {
        'xs': '475px',
        '3xl': '1920px',
      },
    },
  },

  // ===========================================================================
  // Plugins
  // ===========================================================================
  plugins: [
    // Add plugins here as needed
    // require('@tailwindcss/forms'),
    // require('@tailwindcss/typography'),
    // require('@tailwindcss/aspect-ratio'),
  ],

  // ===========================================================================
  // Dark Mode
  // ===========================================================================
  darkMode: 'class',
};

export default config;
