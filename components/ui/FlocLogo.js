// Floc wordmark + ring/dots symbol. Mirrors FlocLogoV4 from the design handoff.
// Symbol: ring + clay center dot + two clay satellite dots.

import { View, Text, StyleSheet } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { colors, fonts } from '../../lib/theme'

export default function FlocLogo({ size = 36, color, accent, showSymbol = true, mono = false, style }) {
  const c = color || colors.ink
  const a = mono ? c : accent || colors.clay
  const gap = size * 0.32

  return (
    <View style={[styles.row, { gap }, style]}>
      {showSymbol ? (
        <Svg width={size} height={size} viewBox="0 0 40 40">
          <Circle cx="20" cy="20" r="16.5" fill="none" stroke={c} strokeWidth={2.4} />
          <Circle cx="20" cy="20" r="5" fill={a} />
          <Circle cx="29" cy="12" r="2.2" fill={a} />
          <Circle cx="11" cy="28" r="2.2" fill={a} opacity={0.55} />
        </Svg>
      ) : null}
      <Text
        style={[
          styles.word,
          {
            fontSize: size * 0.92,
            color: c,
            letterSpacing: -size * 0.04,
            lineHeight: size * 0.95,
          },
        ]}
      >
        floc
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  word: { fontFamily: fonts.displayBold, includeFontPadding: false },
})
