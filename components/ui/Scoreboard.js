// "Scoreboard" stat: big Space Grotesk numeral + tiny uppercase unit.
// Used on cards, run details, profile, create run. direction = 'row' | 'grid'.

import { View, Text, StyleSheet } from 'react-native'
import { colors, fonts, space } from '../../lib/theme'
import MicroLabel from './MicroLabel'

export function ScoreboardItem({ label, value, unit, numeralColor, labelColor, unitColor, compact }) {
  return (
    <View style={styles.item}>
      {label ? <MicroLabel size="sm" color={labelColor || colors.smoke} style={styles.label}>{label}</MicroLabel> : null}
      <View style={styles.row}>
        <Text style={[styles.value, compact && styles.valueCompact, { color: numeralColor || colors.ink }]}>{value}</Text>
        {unit ? <Text style={[styles.unit, { color: unitColor || colors.smoke }]}>{unit}</Text> : null}
      </View>
    </View>
  )
}

export default function Scoreboard({ items, direction = 'row', dividers = true, style, itemColors }) {
  return (
    <View style={[styles.board, direction === 'grid' ? styles.grid : styles.rowBoard, style]}>
      {items.map((it, i) => (
        <View key={i} style={[styles.cell, direction === 'row' && styles.cellRow]}>
          <ScoreboardItem {...it} {...(itemColors || {})} />
          {dividers && direction === 'row' && i < items.length - 1 ? <View style={styles.divider} /> : null}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  board: { alignSelf: 'stretch' },
  rowBoard: { flexDirection: 'row', alignItems: 'stretch' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { flexShrink: 0 },
  cellRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.line,
    marginHorizontal: space.md,
  },
  item: { flex: 1 },
  label: { marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  value: {
    fontFamily: fonts.displayBold,
    fontSize: 28,
    letterSpacing: -0.6,
    lineHeight: 30,
  },
  valueCompact: { fontSize: 22, lineHeight: 24 },
  unit: {
    fontFamily: fonts.displayBold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
})
