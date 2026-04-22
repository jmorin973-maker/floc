// Stacked info row used on Run Details, Create Run.
// Layout: [icon] [micro label + value] ----- [chevron]

import { Pressable, View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts, radii, space } from '../../lib/theme'
import MicroLabel from './MicroLabel'

export default function InfoRow({ icon, label, value, onPress, chevron = true, tint = colors.ink, right, style }) {
  const Tag = onPress ? Pressable : View
  return (
    <Tag onPress={onPress} style={({ pressed }) => [styles.row, pressed && onPress ? styles.pressed : null, style]}>
      {icon ? (
        <View style={styles.icon}>
          {typeof icon === 'string' ? (
            <Ionicons name={icon} size={20} color={tint} />
          ) : icon}
        </View>
      ) : null}
      <View style={styles.body}>
        {label ? <MicroLabel size="sm" color={colors.smoke}>{label}</MicroLabel> : null}
        {typeof value === 'string' ? (
          <Text style={styles.value} numberOfLines={1}>{value}</Text>
        ) : (value)}
      </View>
      {right ? right : chevron && onPress ? (
        <Ionicons name="chevron-forward" size={18} color={colors.smoke} style={styles.chev} />
      ) : null}
    </Tag>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  pressed: { backgroundColor: colors.chalk },
  icon: { width: 24, alignItems: 'center' },
  body: { flex: 1, gap: 3 },
  value: {
    fontFamily: fonts.bodySemibold,
    fontSize: 15,
    color: colors.ink,
  },
  chev: { marginLeft: 'auto' },
})
