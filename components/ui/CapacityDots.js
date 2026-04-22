// Capacity dots — signature motif. Filled = joined, outlined = open slot.
// The latest filled dot is scaled slightly larger with a soft halo.

import { View, StyleSheet } from 'react-native'
import { colors } from '../../lib/theme'

export default function CapacityDots({ joined, capacity, color = colors.clay, size = 10, gap = 6, style }) {
  return (
    <View style={[styles.row, { gap }, style]}>
      {Array.from({ length: capacity }).map((_, i) => {
        const filled = i < joined
        const latest = filled && i === joined - 1
        return (
          <View
            key={i}
            style={[
              styles.dot,
              {
                width: size,
                height: size,
                backgroundColor: filled ? color : 'transparent',
                borderWidth: filled ? 0 : 1.5,
                borderColor: colors.lineStrong,
                transform: [{ scale: latest ? 1.25 : 1 }],
              },
            ]}
          />
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { borderRadius: 999 },
})
