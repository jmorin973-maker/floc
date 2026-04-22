// Run-type badge. variant='soft' (soft-tint bg) or 'filled' (type color bg, cream text).

import { View, Text, StyleSheet } from 'react-native'
import { colors, fonts, radii, runTypeMeta } from '../../lib/theme'

export default function TypeBadge({ type, variant = 'soft', showDot = true, style }) {
  const meta = runTypeMeta(type)
  const filled = variant === 'filled'
  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: filled ? meta.color : meta.soft,
        },
        style,
      ]}
    >
      {showDot && !filled ? (
        <View style={[styles.dot, { backgroundColor: meta.color }]} />
      ) : null}
      <Text style={[styles.text, { color: filled ? colors.cream : meta.color }]}>
        {meta.name}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.chip,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: {
    fontFamily: fonts.displayBold,
    fontSize: 10,
    letterSpacing: 1.6,
  },
})
