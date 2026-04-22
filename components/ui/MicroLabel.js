// Uppercase tracked micro-label. Space Grotesk 700, 9–11px, letter-spaced.
import { Text, StyleSheet } from 'react-native'
import { colors, type } from '../../lib/theme'

export default function MicroLabel({ children, color, size = 'md', style, ...rest }) {
  const base = size === 'sm' ? type.microSm : size === 'lg' ? type.microLg : type.micro
  return (
    <Text {...rest} style={[styles.base, base, { color: color || colors.smoke }, style]}>
      {children}
    </Text>
  )
}

const styles = StyleSheet.create({
  base: { includeFontPadding: false },
})
