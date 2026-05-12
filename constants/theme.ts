// Single source of truth for the tans visual system.
// Light mode only for v1. Dark mode is a follow-up.
// Fonts (Fredoka + Space Grotesk) are loaded via @expo-google-fonts; the
// strings below match the exported font names from those packages.

export const colors = {
  background: 'hsl(36, 40%, 97%)',
  foreground: 'hsl(230, 18%, 28%)',
  card: 'hsl(0, 0%, 100%)',
  cardForeground: 'hsl(230, 18%, 28%)',
  primary: 'hsl(340, 55%, 75%)',
  primaryForeground: 'hsl(230, 25%, 22%)',
  secondary: 'hsl(50, 65%, 82%)',
  secondaryForeground: 'hsl(230, 25%, 22%)',
  muted: 'hsl(230, 25%, 94%)',
  mutedForeground: 'hsl(230, 12%, 52%)',
  accent: 'hsl(200, 50%, 80%)',
  accentForeground: 'hsl(230, 25%, 22%)',
  destructive: 'hsl(5, 55%, 75%)',
  destructiveForeground: 'hsl(230, 25%, 22%)',
  border: 'hsl(230, 20%, 90%)',
  ring: 'hsl(340, 55%, 75%)',
  success: 'hsl(150, 40%, 70%)',
  successForeground: 'hsl(230, 25%, 22%)',
  warm: 'hsl(25, 70%, 80%)',

  brickRed: 'hsl(354, 75%, 78%)',
  brickOrange: 'hsl(22, 85%, 76%)',
  brickYellow: 'hsl(46, 90%, 76%)',
  brickGreen: 'hsl(140, 45%, 72%)',
  brickCyan: 'hsl(188, 55%, 74%)',
  brickBlue: 'hsl(215, 65%, 78%)',
  brickPurple: 'hsl(280, 45%, 80%)',

  // Translucent overlays
  foregroundFaint: 'hsla(230, 18%, 28%, 0.18)',
  mutedForegroundFaint: 'hsla(230, 12%, 52%, 0.35)',
  scrim: 'hsla(0, 0%, 0%, 0.4)',
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
} as const;

export const fonts = {
  sans: 'SpaceGrotesk_500Medium',
  sansBold: 'SpaceGrotesk_700Bold',
  display: 'Fredoka_600SemiBold',
} as const;

export const habitBorders = [
  colors.brickRed,
  colors.brickBlue,
  colors.brickYellow,
  colors.brickGreen,
  colors.brickOrange,
];
