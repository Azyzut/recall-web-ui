import type { Config } from 'tailwindcss'
import { colors, spacing, shadows, borderRadius } from './lib/design-tokens'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: colors.primary,
        neutral: colors.neutral,
        success: colors.success,
        warning: colors.warning,
        error: colors.error,
        background: 'var(--background)',
        foreground: 'var(--foreground)',
      },
      spacing,
      boxShadow: shadows,
      borderRadius,
    },
  },
  plugins: [],
}
export default config