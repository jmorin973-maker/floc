// 5-segment (configurable) progress strip used during onboarding.
// 3px tall. Clay for completed+current, lineStrong for upcoming.

import { View, StyleSheet } from 'react-native'
import { colors } from '../../lib/theme'

export default function ProgressStrip({ current, total, style }) {
  return (
    <View style={[styles.row, style]}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.seg,
            { backgroundColor: i < current ? colors.clay : colors.lineStrong },
          ]}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignSelf: 'stretch', gap: 6 },
  seg: { flex: 1, height: 3, borderRadius: 2 },
})
