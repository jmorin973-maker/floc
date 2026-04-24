// Floating LIST / MAP pill toggle, sits above the tab bar.
// Ink background, clay highlight on the active segment.

import { Pressable, View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts, shadows } from '../../lib/theme'

export default function ListMapPill({ value, onChange, style, compact }) {
  return (
    <View style={[styles.pill, shadows.pill, compact && styles.pillCompact, style]}>
      <Seg active={value === 'list'} onPress={() => onChange('list')} icon="list" label="LIST" compact={compact} />
      <Seg active={value === 'map'} onPress={() => onChange('map')} icon="map" label="MAP" compact={compact} />
    </View>
  )
}

function Seg({ active, onPress, icon, label, compact }) {
  return (
    <Pressable onPress={onPress} style={[styles.seg, compact && styles.segCompact, active && styles.segActive]}>
      <Ionicons name={icon} size={compact ? 13 : 14} color={active ? colors.ink : colors.cream} />
      {compact ? null : (
        <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    backgroundColor: colors.ink,
    borderRadius: 999,
    padding: 4,
    alignSelf: 'center',
  },
  pillCompact: { padding: 3 },
  seg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  segCompact: {
    width: 34, height: 28,
    paddingHorizontal: 0, paddingVertical: 0,
    justifyContent: 'center', gap: 0,
  },
  segActive: { backgroundColor: colors.cream },
  label: {
    fontFamily: fonts.displayBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.cream,
  },
  labelActive: { color: colors.ink },
})
