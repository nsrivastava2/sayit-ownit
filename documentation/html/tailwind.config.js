module.exports = {
  content: [
    "./pages/*.{html,js}",
    "./index.html",
    "./src/**/*.{html,js}",
    "./*.{html,js}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary Colors - Deep professional blue
        primary: {
          DEFAULT: '#1E40AF', // blue-800
          50: '#EFF6FF', // blue-50
          100: '#DBEAFE', // blue-100
          200: '#BFDBFE', // blue-200
          300: '#93C5FD', // blue-300
          400: '#60A5FA', // blue-400
          500: '#3B82F6', // blue-500
          600: '#2563EB', // blue-600
          700: '#1D4ED8', // blue-700
          800: '#1E40AF', // blue-800
          900: '#1E3A8A', // blue-900
          foreground: '#FFFFFF', // white
        },
        // Secondary Colors - Teal accent
        secondary: {
          DEFAULT: '#0891B2', // cyan-600
          50: '#ECFEFF', // cyan-50
          100: '#CFFAFE', // cyan-100
          200: '#A5F3FC', // cyan-200
          300: '#67E8F9', // cyan-300
          400: '#22D3EE', // cyan-400
          500: '#06B6D4', // cyan-500
          600: '#0891B2', // cyan-600
          700: '#0E7490', // cyan-700
          800: '#155E75', // cyan-800
          900: '#164E63', // cyan-900
          foreground: '#FFFFFF', // white
        },
        // Accent Colors - Warm amber
        accent: {
          DEFAULT: '#F59E0B', // amber-500
          50: '#FFFBEB', // amber-50
          100: '#FEF3C7', // amber-100
          200: '#FDE68A', // amber-200
          300: '#FCD34D', // amber-300
          400: '#FBBF24', // amber-400
          500: '#F59E0B', // amber-500
          600: '#D97706', // amber-600
          700: '#B45309', // amber-700
          800: '#92400E', // amber-800
          900: '#78350F', // amber-900
          foreground: '#1F2937', // gray-800
        },
        // Background Colors
        background: {
          DEFAULT: '#FAFBFC', // custom-gray-50
          foreground: '#111827', // gray-900
        },
        // Surface Colors
        surface: {
          DEFAULT: '#FFFFFF', // white
          foreground: '#111827', // gray-900
          elevated: '#F9FAFB', // gray-50
        },
        // Text Colors
        text: {
          primary: '#111827', // gray-900
          secondary: '#6B7280', // gray-500
          tertiary: '#9CA3AF', // gray-400
        },
        // Success Colors
        success: {
          DEFAULT: '#059669', // emerald-600
          50: '#ECFDF5', // emerald-50
          100: '#D1FAE5', // emerald-100
          200: '#A7F3D0', // emerald-200
          300: '#6EE7B7', // emerald-300
          400: '#34D399', // emerald-400
          500: '#10B981', // emerald-500
          600: '#059669', // emerald-600
          700: '#047857', // emerald-700
          800: '#065F46', // emerald-800
          900: '#064E3B', // emerald-900
          foreground: '#FFFFFF', // white
        },
        // Warning Colors
        warning: {
          DEFAULT: '#D97706', // amber-600
          50: '#FFFBEB', // amber-50
          100: '#FEF3C7', // amber-100
          200: '#FDE68A', // amber-200
          300: '#FCD34D', // amber-300
          400: '#FBBF24', // amber-400
          500: '#F59E0B', // amber-500
          600: '#D97706', // amber-600
          700: '#B45309', // amber-700
          800: '#92400E', // amber-800
          900: '#78350F', // amber-900
          foreground: '#FFFFFF', // white
        },
        // Error Colors
        error: {
          DEFAULT: '#DC2626', // red-600
          50: '#FEF2F2', // red-50
          100: '#FEE2E2', // red-100
          200: '#FECACA', // red-200
          300: '#FCA5A5', // red-300
          400: '#F87171', // red-400
          500: '#EF4444', // red-500
          600: '#DC2626', // red-600
          700: '#B91C1C', // red-700
          800: '#991B1B', // red-800
          900: '#7F1D1D', // red-900
          foreground: '#FFFFFF', // white
        },
        // Border Colors
        border: {
          DEFAULT: '#E2E8F0', // slate-200
          light: '#F1F5F9', // slate-100
          dark: '#CBD5E1', // slate-300
        },
      },
      fontFamily: {
        heading: ['Manrope', 'sans-serif'],
        body: ['Source Sans 3', 'sans-serif'],
        caption: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        xs: ['0.875rem', { lineHeight: '1.4' }],
        sm: ['0.9375rem', { lineHeight: '1.6' }],
        base: ['1rem', { lineHeight: '1.6' }],
        lg: ['1.125rem', { lineHeight: '1.5' }],
        xl: ['1.25rem', { lineHeight: '1.4' }],
        '2xl': ['1.5rem', { lineHeight: '1.3' }],
        '3xl': ['1.875rem', { lineHeight: '1.25' }],
        '4xl': ['2.25rem', { lineHeight: '1.2' }],
      },
      spacing: {
        xs: '0.5rem', // 8px
        sm: '1rem', // 16px
        md: '1.25rem', // 20px
        lg: '2rem', // 32px
        xl: '5rem', // 80px
      },
      borderRadius: {
        sm: '0.375rem', // 6px
        md: '0.75rem', // 12px
        lg: '1.125rem', // 18px
        xl: '1.5rem', // 24px
        '2xl': '1.125rem', // 18px for modals
      },
      boxShadow: {
        sm: '0 1px 3px 0 rgba(15, 23, 42, 0.08)',
        DEFAULT: '0 2px 6px 0 rgba(15, 23, 42, 0.08)',
        md: '0 4px 12px 0 rgba(15, 23, 42, 0.08)',
        lg: '0 8px 20px -4px rgba(15, 23, 42, 0.16)',
        xl: '0 20px 40px -8px rgba(15, 23, 42, 0.16)',
        'glow-sm': '0 0 8px 0 rgba(59, 130, 246, 0.15)',
        'glow-md': '0 0 16px 0 rgba(59, 130, 246, 0.25)',
      },
      transitionDuration: {
        250: '250ms',
      },
      transitionTimingFunction: {
        'ease-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      zIndex: {
        base: '0',
        card: '1',
        sticky: '10',
        dropdown: '50',
        navigation: '100',
        modal: '200',
        toast: '300',
      },
      maxWidth: {
        'prose': '70ch',
      },
      letterSpacing: {
        tighter: '-0.01em',
      },
      gap: {
        grid: '1.25rem', // 20px
      },
      animation: {
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'dropdown-open': 'dropdown-open 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        'stagger-fade-in': 'stagger-fade-in 400ms cubic-bezier(0.4, 0, 0.2, 1) backwards',
      },
      keyframes: {
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'dropdown-open': {
          from: {
            opacity: '0',
            transform: 'translateY(-8px)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        'stagger-fade-in': {
          from: {
            opacity: '0',
            transform: 'translateY(16px)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
      },
      fontFeatureSettings: {
        'tnum': '"tnum"',
      },
    },
  },
  plugins: [
    function({ addUtilities }) {
      const newUtilities = {
        '.tabular-nums': {
          fontFeatureSettings: '"tnum"',
          fontVariantNumeric: 'tabular-nums',
        },
        '.text-balance': {
          textWrap: 'balance',
        },
      }
      addUtilities(newUtilities)
    },
  ],
}