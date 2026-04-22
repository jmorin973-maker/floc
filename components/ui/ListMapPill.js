// Floating LIST / MAP pill toggle, sits above the tab bar.
// Ink background, clay highlight on the active segment.

import { Pressable, View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts, shadows } from '../../lib/theme'

export default function ListMapPill({ value, onChange, style }) {
  return (
    <View style={[styles.pill, shadows.pill, style]}>
      <Seg active={value === 'list'} onPress={() => onChange('list')} icon="list" label="LIST" />
      <Seg active={value === 'map'} onPress={() => onChange('map')} icon="map" label="MAP" />
    </View>
  )
}

function Seg({ active, onPress, icon, label }) {
  return (
    <Pressable onPress={onPress} style={[styles.seg, active && styles.segActive]}>
      <Ionicons name={icon} size={14} color={active ? colors.ink : colors.cream} />
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
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
  seg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
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
