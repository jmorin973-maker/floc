// Floc v4 design tokens. Source of truth for colors, type, spacing, radii.
// Mirrors lib/v4-system.jsx from the design handoff.

export const colors = {
  cream: '#F4ECDF',        // main surface
  paper: '#FAF5EC',        // cards, inputs, elevated surfaces
  ink: '#181410',          // primary text + dark hero
  ink2: '#2A231D',         // secondary text on cream
  smoke: '#7D7265',        // tertiary text, labels, meta
  line: 'rgba(24,20,16,0.10)',        // hairline border on cream
  lineStrong: 'rgba(24,20,16,0.20)',  // active/focused border
  clay: '#C24A2E',         // primary accent, CTAs, active states
  claySoft: '#F1D4C8',
  clayDeep: '#8F2F1A',
  moss: '#4A6B3F',         // secondary accent (joined states)
  mossSoft: '#D6DDC9',
  chalk: '#E8E0D0',        // zebra rows, soft fills
  white: '#FFFFFF',
  transparent: 'transparent',
}

// Run-type palette (letter badge, accent color, soft background).
export const runTypes = {
  easy:      { color: '#4A7C3A', soft: '#D6E4C9', name: 'EASY',      letter: 'E' },
  tempo:     { color: '#C9941A', soft: '#F0DEB0', name: 'TEMPO',     letter: 'T' },
  intervals: { color: '#C24A2E', soft: '#F1D4C8', name: 'INTERVALS', letter: 'I' },
  long:      { color: '#3A6EA8', soft: '#CCDCEE', name: 'LONG',      letter: 'L' },
  hills:     { color: '#6B4A8A', soft: '#D6CCE4', name: 'HILLS',     letter: 'H' },
}

export function runTypeMeta(type) {
  return runTypes[type] || { color: colors.smoke, soft: colors.chalk, name: (type || '').toUpperCase(), letter: (type || '?')[0]?.toUpperCase() || '?' }
}

// Font families. Loaded via expo-font in App.js.
export const fonts = {
  displayBold:   'SpaceGrotesk_700Bold',      // titles, labels
  displayMedium: 'SpaceGrotesk_500Medium',
  body:          'Inter_400Regular',
  bodyMedium:    'Inter_500Medium',
  bodySemibold:  'Inter_600SemiBold',
}

// Type scale (matches design handoff §Typography).
export const type = {
  hero:      { fontFamily: fonts.displayBold, fontSize: 40, lineHeight: 40 * 0.9, letterSpacing: -2 },
  section:   { fontFamily: fonts.displayBold, fontSize: 32, lineHeight: 32 * 0.92, letterSpacing: -1.4 },
  cardTitle: { fontFamily: fonts.displayBold, fontSize: 18, lineHeight: 22, letterSpacing: -0.4 },
  scoreNum:  { fontFamily: fonts.displayBold, fontSize: 28, lineHeight: 30, letterSpacing: -0.6 },
  body:      { fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  bodySm:    { fontFamily: fonts.body, fontSize: 13, lineHeight: 20 },
  // Uppercase tracked micro-labels.
  micro:     { fontFamily: fonts.displayBold, fontSize: 10, letterSpacing: 1.8, textTransform: 'uppercase' },
  microLg:   { fontFamily: fonts.displayBold, fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase' },
  microSm:   { fontFamily: fonts.displayBold, fontSize: 9,  letterSpacing: 1.4, textTransform: 'uppercase' },
}

// Spacing scale (base 4px). Use e.g. space.md = 14.
export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 36,
  h: 18, // default horizontal screen padding
}

export const radii = {
  chip: 4,
  card: 6,
  button: 6,
  circle: 999,
}

export const shadows = {
  none: {},
  fab: {
    shadowColor: colors.clay,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  pill: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 6,
  },
}

export const theme = { colors, runTypes, runTypeMeta, fonts, type, space, radii, shadows }
export default theme
