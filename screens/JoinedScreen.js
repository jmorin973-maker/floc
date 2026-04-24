// Post-join confirmation. Dark ink background with the dots motif —
// confetti dots + dashed rings + big clay center dot. Shown as a modal
// after a successful confirmed join (not waitlist).
//
// Two actions:
//   - Add to calendar → opens Google Calendar event template in browser
//   - Back to discover → dismisses and goes to the Discover tab

import { useEffect, useRef } from 'react'
import {
  Animated, Easing, Linking, Modal, Pressable,
  StatusBar, StyleSheet, Text, View,
} from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts, radii, space } from '../lib/theme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

const CONFETTI = [
  [40, 60, 6, colors.clay, 0.85],
  [280, 50, 5, colors.clay, 0.9],
  [60, 180, 4, colors.moss, 0.7],
  [260, 200, 5, colors.clay, 0.7],
  [150, 40, 4, colors.cream, 0.55],
  [220, 140, 3, colors.cream, 0.4],
  [100, 110, 3, colors.clay, 0.5],
  [190, 220, 4, colors.clay, 0.85],
]

export default function JoinedScreen({ visible, onClose, run, confirmedCount }) {
  const t = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!visible) return
    t.setValue(0)
    Animated.loop(
      Animated.timing(t, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: false }),
    ).start()
  }, [visible])

  const centerR = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [20, 26, 20] })
  const ringOpacity = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 0.7, 0.3] })
  const flockSize = run ? (confirmedCount != null ? confirmedCount : 1) : 1

  function handleAddToCalendar() {
    if (!run) return
    try {
      const start = new Date(`${run.date}T${run.time}`)
      const mins = paceToMins(run.pace) * Number(run.distance || 0)
      const end = new Date(start.getTime() + (mins > 0 ? mins : 60) * 60 * 1000)
      const fmt = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
      const url = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
        + `&text=${encodeURIComponent(run.title)}`
        + `&dates=${fmt(start)}/${fmt(end)}`
        + `&location=${encodeURIComponent(run.meeting_point || run.city || '')}`
        + `&details=${encodeURIComponent(`Floc: ${run.distance || ''} mi @ ${run.pace || ''}/mi`)}`
      Linking.openURL(url)
    } catch (e) { console.error('calendar url:', e) }
  }

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <StatusBar barStyle="light-content" />
      <View style={styles.root}>
        {/* Confetti + central ring + pulsing dot */}
        <View style={styles.svgWrap}>
          <Svg width="100%" height={260} viewBox="0 0 320 260">
            {CONFETTI.map((c, i) => (
              <Circle key={i} cx={c[0]} cy={c[1]} r={c[2]} fill={c[3]} opacity={c[4]} />
            ))}
            <Circle cx="160" cy="130" r="60" fill="none" stroke="rgba(244,236,223,0.15)" strokeWidth="1.5" />
            <AnimatedCircle
              cx="160" cy="130" r="40" fill="none"
              stroke={colors.clay} strokeWidth="1.5"
              strokeDasharray="3 3" opacity={ringOpacity}
            />
            <AnimatedCircle cx="160" cy="130" r={centerR} fill={colors.clay} />
          </Svg>
        </View>

        {/* Copy */}
        <View style={styles.copy}>
          <View style={styles.microRow}>
            <View style={styles.microDot} />
            <Text style={styles.micro}>YOU'RE IN</Text>
          </View>
          <Text style={styles.title}>Flock of {flockSize}.</Text>
          {run ? (
            <Text style={styles.sub}>
              You've joined <Text style={styles.subBold}>{run.title}</Text>
              {run.date ? `, ${formatDate(run.date)}` : ''}
              {run.time ? ` at ${formatTime(run.time)}` : ''}.
              {'\n'}We'll remind you the night before.
            </Text>
          ) : null}
        </View>

        {/* Actions */}
        <View style={styles.footer}>
          <Pressable onPress={handleAddToCalendar} style={styles.btnPrimary}>
            <Text style={styles.btnPrimaryText}>ADD TO CALENDAR</Text>
            <Ionicons name="calendar-outline" size={14} color={colors.cream} />
          </Pressable>
          <Pressable onPress={onClose} style={styles.btnGhost}>
            <Text style={styles.btnGhostText}>BACK TO DISCOVER</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

function paceToMins(pace) {
  if (!pace) return 0
  const [m, s] = String(pace).split(':').map(Number)
  return (m || 0) + (s || 0) / 60
}

function formatDate(d) {
  const date = new Date(d)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()}`
}

function formatTime(t) {
  const [hh, mm] = String(t).split(':')
  const hour = parseInt(hh, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${display}:${mm} ${ampm}`
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  svgWrap: { position: 'absolute', top: 54, left: 0, right: 0 },
  copy: {
    position: 'absolute', top: 340, left: 0, right: 0,
    paddingHorizontal: space.xl, alignItems: 'center',
  },
  microRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  microDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.clay },
  micro: {
    fontFamily: fonts.displayBold, fontSize: 10,
    letterSpacing: 2.4, color: colors.clay,
  },
  title: {
    fontFamily: fonts.displayBold, fontSize: 42, lineHeight: 42 * 1.1,
    letterSpacing: -2, color: colors.cream, textTransform: 'uppercase',
    textAlign: 'center',
  },
  sub: {
    fontFamily: fonts.body, fontSize: 14, lineHeight: 21,
    color: 'rgba(244,236,223,0.65)', textAlign: 'center',
    marginTop: 14, maxWidth: 300,
  },
  subBold: { color: colors.cream, fontFamily: fonts.bodySemibold },
  footer: {
    position: 'absolute', left: space.lg, right: space.lg, bottom: 34, gap: 8,
  },
  btnPrimary: {
    height: 50, borderRadius: radii.button,
    backgroundColor: colors.clay,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  btnPrimaryText: {
    fontFamily: fonts.displayBold, fontSize: 13,
    letterSpacing: 1.8, color: colors.cream,
  },
  btnGhost: {
    height: 44, borderRadius: radii.button,
    borderWidth: 1, borderColor: 'rgba(244,236,223,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  btnGhostText: {
    fontFamily: fonts.displayBold, fontSize: 12,
    letterSpacing: 1.6, color: colors.cream,
  },
})
