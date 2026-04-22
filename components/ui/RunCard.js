// Signature run card. Structure:
//   [4px type stripe] | body:
//     TypeBadge + meta (time · distance)
//     title
//     scoreboard (distance · pace) · capacity dots · join button
//
// Props:
//   run: { id, title, type, distance, pace, start_at, spots, joined_count }
//   onPress: opens run details
//   onJoin: join action (optional — pass null to omit button)
//   joinLabel: default "JOIN"
//   joined: boolean (already joined)

import { Pressable, View, Text, StyleSheet } from 'react-native'
import { colors, fonts, radii, space, runTypeMeta } from '../../lib/theme'
import TypeBadge from './TypeBadge'
import CapacityDots from './CapacityDots'
import { ScoreboardItem } from './Scoreboard'
import MicroLabel from './MicroLabel'

export default function RunCard({ run, onPress, onJoin, joined, joinLabel, style, compact }) {
  const meta = runTypeMeta(run?.type)
  const joinedCount = run?.joined_count ?? run?.confirmed_count ?? 0
  const spots = run?.spots ?? run?.capacity ?? 0
  const spotsLeft = Math.max(0, spots - joinedCount)

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.wrap, pressed && styles.pressed, style]}>
      <View style={[styles.stripe, { backgroundColor: meta.color }]} />
      <View style={[styles.body, compact && styles.bodyCompact]}>
        <View style={styles.topRow}>
          <TypeBadge type={run?.type} />
          {run?.meta ? (
            <MicroLabel size="sm" color={colors.smoke}>{run.meta}</MicroLabel>
          ) : null}
        </View>

        <Text style={styles.title} numberOfLines={2}>{run?.title}</Text>

        <View style={styles.stats}>
          {run?.distance != null ? (
            <ScoreboardItem value={fmtDistance(run.distance)} unit="MI" compact />
          ) : null}
          {run?.pace ? (
            <ScoreboardItem value={run.pace} unit="/MI" compact />
          ) : null}
        </View>

        <View style={styles.footer}>
          <CapacityDots joined={joinedCount} capacity={spots} color={meta.color} />
          {onJoin ? (
            <Pressable
              onPress={(e) => { e.stopPropagation && e.stopPropagation(); onJoin(run) }}
              style={[styles.joinBtn, joined && styles.joinBtnJoined]}
            >
              <Text style={[styles.joinText, joined && styles.joinTextJoined]}>
                {joined ? 'JOINED' : (joinLabel || (spotsLeft === 0 ? 'WAITLIST' : 'JOIN'))}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Pressable>
  )
}

function fmtDistance(d) {
  const n = Number(d)
  if (!isFinite(n)) return '--'
  return n >= 10 ? n.toFixed(0) : n.toFixed(1)
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: colors.paper,
    borderRadius: radii.card,
    marginBottom: space.sm,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.9 },
  stripe: { width: 4, alignSelf: 'stretch' },
  body: { flex: 1, padding: space.md, gap: 10 },
  bodyCompact: { padding: space.sm, gap: 6 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  stats: { flexDirection: 'row', gap: space.xl },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  joinBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.button,
    backgroundColor: colors.ink,
  },
  joinBtnJoined: { backgroundColor: colors.mossSoft },
  joinText: {
    fontFamily: fonts.displayBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.cream,
  },
  joinTextJoined: { color: colors.moss },
})
