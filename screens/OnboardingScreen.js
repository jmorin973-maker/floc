// Floc v4 onboarding — 5 steps, each persisted to profiles as the user goes.
// Steps: welcome → pace → run types → location → notifications.

import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, Pressable, ScrollView, Alert,
  Linking, ActivityIndicator,
} from 'react-native'
import Svg, { Circle, Line } from 'react-native-svg'
import * as Location from 'expo-location'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { registerForPushNotificationsAsync, savePushToken } from '../lib/notifications'
import { colors, fonts, space, radii, type, runTypes } from '../lib/theme'
import OnboardingShell from '../components/ui/OnboardingShell'
import Toggle from '../components/ui/Toggle'
import MicroLabel from '../components/ui/MicroLabel'

const TOTAL = 5

const PACE_OPTIONS = [
  { key: 'easy',           label: 'EASY',           sub: '9:30+ /mi' },
  { key: 'conversational', label: 'CONVERSATIONAL', sub: '8:30–9:30 /mi' },
  { key: 'moderate',       label: 'MODERATE',       sub: '7:30–8:30 /mi' },
  { key: 'fast',           label: 'FAST',           sub: '6:30–7:30 /mi' },
  { key: 'all',            label: 'ANY PACE',       sub: 'depends on the day' },
]

const RUN_TYPE_DESC = {
  easy: 'Chatty, low HR',
  tempo: 'Comfortably hard',
  intervals: 'Track + reps',
  long: '10+ miles',
  hills: 'Climb + grind',
}

export default function OnboardingScreen({ userId, onComplete }) {
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [pace, setPace] = useState('conversational')
  const [types, setTypes] = useState(['easy', 'long', 'tempo'])
  const [location, setLocation] = useState(null) // { label, lat, lng }
  const [radius, setRadius] = useState(5)
  const [notifs, setNotifs] = useState({
    newRuns: true, flockUpdates: true, reminders: true, weeklyDigest: false,
  })
  const [locating, setLocating] = useState(false)

  // Step 4 — request location once we land on the step.
  useEffect(() => {
    if (step !== 4 || location) return
    let cancelled = false
    ;(async () => {
      setLocating(true)
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') return
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        if (cancelled) return
        const revs = await Location.reverseGeocodeAsync(pos.coords)
        const best = revs?.[0]
        const label = best ? `${best.city || best.subregion || best.region || 'UNKNOWN'}, ${best.region || ''}`.trim().replace(/,$/, '') : 'Detected'
        setLocation({ label, lat: pos.coords.latitude, lng: pos.coords.longitude })
      } catch (e) {
        // Silently ignore — user can still proceed; we'll just not persist lat/lng.
      } finally {
        if (!cancelled) setLocating(false)
      }
    })()
    return () => { cancelled = true }
  }, [step])

  async function persistStep(updates) {
    if (!userId) return
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId)
    if (error) console.error('onboarding persist error:', error)
  }

  async function next() {
    setSaving(true)
    try {
      if (step === 2) await persistStep({ pace })
      else if (step === 3) await persistStep({ run_types: types })
      else if (step === 4) await persistStep({
        location_label: location?.label || null,
        location_lat: location?.lat || null,
        location_lng: location?.lng || null,
        search_radius_mi: radius,
      })
      else if (step === 5) {
        await persistStep({
          notify_new_runs: notifs.newRuns,
          notify_flock_updates: notifs.flockUpdates,
          notify_reminders: notifs.reminders,
          notify_weekly_digest: notifs.weeklyDigest,
          onboarding_completed_at: new Date().toISOString(),
        })
        if (notifs.newRuns || notifs.flockUpdates || notifs.reminders) {
          const token = await registerForPushNotificationsAsync()
          if (token) await savePushToken(userId, token)
        }
        onComplete && onComplete()
        return
      }

      if (step < TOTAL) setStep(step + 1)
    } finally {
      setSaving(false)
    }
  }

  const skipAll = () => onComplete && onComplete()

  return (
    <OnboardingShell
      step={step}
      total={TOTAL}
      onSkip={step < TOTAL ? skipAll : undefined}
      onNext={next}
      ctaLoading={saving}
      ctaLabel={step === 5 ? 'ENABLE NOTIFICATIONS →' : 'CONTINUE →'}
      title={titleFor(step)}
      subtitle={subtitleFor(step)}
    >
      {step === 1 && <Step1Illustration />}
      {step === 2 && <Step2Pace value={pace} onChange={setPace} />}
      {step === 3 && <Step3Types value={types} onChange={setTypes} />}
      {step === 4 && (
        <Step4Location
          location={location}
          locating={locating}
          radius={radius}
          setRadius={setRadius}
        />
      )}
      {step === 5 && <Step5Notifs value={notifs} onChange={setNotifs} />}
    </OnboardingShell>
  )
}

function titleFor(step) {
  return {
    1: 'Runners,\ngathered.',
    2: "What's your\npace?",
    3: 'What kind\nof runs?',
    4: 'Where are\nyou running?',
    5: 'Stay in\nthe loop.',
  }[step]
}

function subtitleFor(step) {
  return {
    1: 'A flock starts with one dot. Post a run, join a run, meet the runners in your city. No streaks, no leaderboards — just company on the road.',
    2: "We'll show you runs matched to your range. You can always change this later.",
    3: 'Pick as many as you like. These shape your Discover feed.',
    4: "We'll show you flocks within your radius. Change it any time.",
    5: "We'll ping you when a new run posts in your area, and when the flock starts forming for one you've joined.",
  }[step]
}

// ── Step illustrations / widgets ───────────────────────────────────────────

function Step1Illustration() {
  const dots = [
    [120, 120, 14, colors.clay, 1],
    [80,  100, 7,  colors.clay, 0.8],
    [160, 90,  8,  colors.ink,  0.85],
    [170, 150, 6,  colors.clay, 0.7],
    [90,  160, 7,  colors.moss, 0.8],
    [60,  130, 5,  colors.ink,  0.6],
    [185, 120, 5,  colors.clay, 0.6],
    [130, 75,  5,  colors.moss, 0.7],
    [110, 170, 6,  colors.ink,  0.7],
  ]
  const lines = [[80,100,120,120],[160,90,120,120],[170,150,120,120],[90,160,120,120]]
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: space.xl }}>
      <Svg width={220} height={220} viewBox="0 0 240 240">
        {lines.map((l, i) => (
          <Line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke={colors.ink} strokeWidth={1} opacity={0.15} />
        ))}
        {dots.map((p, i) => (
          <Circle key={i} cx={p[0]} cy={p[1]} r={p[2]} fill={p[3]} opacity={p[4]} />
        ))}
      </Svg>
    </View>
  )
}

function Step2Pace({ value, onChange }) {
  return (
    <View style={{ gap: 8 }}>
      {PACE_OPTIONS.map((p) => {
        const active = value === p.key
        return (
          <Pressable
            key={p.key}
            onPress={() => onChange(p.key)}
            style={[styles.paceRow, active && styles.paceRowActive]}
          >
            <View style={styles.paceText}>
              <Text style={[styles.paceLabel, active && styles.paceLabelActive]}>{p.label}</Text>
              <Text style={[styles.paceSub, active && styles.paceSubActive]}>{p.sub}</Text>
            </View>
            <View style={[styles.radio, active && styles.radioActive]}>
              {active ? <View style={styles.radioDot} /> : null}
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

function Step3Types({ value, onChange }) {
  function toggle(k) {
    onChange(value.includes(k) ? value.filter(x => x !== k) : [...value, k])
  }
  return (
    <View style={styles.typeGrid}>
      {Object.entries(runTypes).map(([key, t]) => {
        const on = value.includes(key)
        return (
          <Pressable
            key={key}
            onPress={() => toggle(key)}
            style={[
              styles.typeCard,
              on ? { backgroundColor: t.soft, borderColor: t.color, borderWidth: 1.5 } : null,
            ]}
          >
            <View style={[styles.typeTile, { backgroundColor: t.color }]}>
              <Text style={styles.typeTileLetter}>{t.letter}</Text>
            </View>
            <Text style={styles.typeTitle}>{t.name}</Text>
            <Text style={styles.typeSub}>{RUN_TYPE_DESC[key]}</Text>
            {on ? (
              <View style={[styles.checkBadge, { backgroundColor: t.color }]}>
                <Ionicons name="checkmark" size={11} color="#fff" />
              </View>
            ) : null}
          </Pressable>
        )
      })}
    </View>
  )
}

function Step4Location({ location, locating, radius, setRadius }) {
  return (
    <View style={{ gap: space.md }}>
      <View style={styles.infoCard}>
        <Ionicons name="location-sharp" size={22} color={colors.clay} />
        <View style={{ flex: 1 }}>
          {locating && !location ? (
            <ActivityIndicator size="small" color={colors.clay} style={{ alignSelf: 'flex-start' }} />
          ) : (
            <>
              <Text style={styles.locationTitle}>{(location?.label || 'YOUR CITY').toUpperCase()}</Text>
              <MicroLabel size="sm" color={colors.smoke}>
                {location ? 'DETECTED · TAP TO CHANGE' : 'TAP TO SET'}
              </MicroLabel>
            </>
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.smoke} />
      </View>

      <View style={styles.infoCard}>
        <View style={{ flex: 1 }}>
          <View style={styles.radiusHeader}>
            <MicroLabel size="sm" color={colors.smoke}>SEARCH RADIUS</MicroLabel>
            <Text style={styles.radiusValue}>{formatRadius(radius)}</Text>
          </View>
          <Slider value={radius} min={0.5} max={10} step={0.5} onChange={setRadius} />
          <View style={styles.radiusEnds}>
            <MicroLabel size="sm" color={colors.smoke}>0.5 MI</MicroLabel>
            <MicroLabel size="sm" color={colors.smoke}>10 MI</MicroLabel>
          </View>
        </View>
      </View>
    </View>
  )
}

function formatRadius(r) {
  const n = Number(r)
  return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)} MI`
}

// Lightweight slider: 9 buttons across the track, but visually continuous.
function Slider({ value, min, max, step, onChange }) {
  const fraction = (value - min) / (max - min)
  const [width, setWidth] = useState(0)

  function onTap(e) {
    const x = e.nativeEvent.locationX
    if (!width) return
    const clamped = Math.max(0, Math.min(width, x))
    const raw = min + (clamped / width) * (max - min)
    const snapped = Math.round(raw / step) * step
    onChange(Math.max(min, Math.min(max, snapped)))
  }

  return (
    <Pressable
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onPress={onTap}
      style={styles.track}
    >
      <View style={styles.trackBase} />
      <View style={[styles.trackFill, { width: `${fraction * 100}%` }]} />
      <View style={[styles.thumb, { left: `${fraction * 100}%`, marginLeft: -10 }]} />
    </Pressable>
  )
}

function Step5Notifs({ value, onChange }) {
  const rows = [
    { key: 'newRuns',      label: 'New runs nearby', sub: 'Within your radius, within your pace' },
    { key: 'flockUpdates', label: 'Flock updates',   sub: 'When someone joins a run you posted' },
    { key: 'reminders',    label: 'Reminders',       sub: 'Night-before + 1-hour-before pings' },
    { key: 'weeklyDigest', label: 'Weekly digest',   sub: 'One email a week. Never spam.' },
  ]
  return (
    <View style={{ gap: 10 }}>
      {rows.map((r) => (
        <View key={r.key} style={styles.notifRow}>
          <Ionicons name="notifications-outline" size={20} color={value[r.key] ? colors.clay : colors.smoke} />
          <View style={{ flex: 1 }}>
            <Text style={styles.notifLabel}>{r.label}</Text>
            <Text style={styles.notifSub}>{r.sub}</Text>
          </View>
          <Toggle value={value[r.key]} onChange={(v) => onChange({ ...value, [r.key]: v })} />
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  paceRow: {
    paddingVertical: 14,
    paddingHorizontal: space.md,
    backgroundColor: colors.paper,
    borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.line,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  paceRowActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  paceText: { flex: 1, minWidth: 0 },
  paceLabel: {
    fontFamily: fonts.displayBold, fontSize: 14, letterSpacing: -0.3,
    color: colors.ink, textTransform: 'uppercase',
  },
  paceLabelActive: { color: colors.cream },
  paceSub: {
    fontFamily: fonts.displayMedium, fontSize: 11, color: colors.smoke, marginTop: 2,
  },
  paceSubActive: { color: 'rgba(244,236,223,0.6)' },
  radio: {
    width: 20, height: 20, borderRadius: 999,
    borderWidth: 1.5, borderColor: colors.lineStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { backgroundColor: colors.clay, borderColor: colors.clay },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeCard: {
    width: '48.5%',
    padding: 14,
    backgroundColor: colors.paper,
    borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.line,
    position: 'relative',
  },
  typeTile: {
    width: 22, height: 22, borderRadius: 4,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  typeTileLetter: { fontFamily: fonts.displayBold, fontSize: 12, color: '#fff' },
  typeTitle: {
    fontFamily: fonts.displayBold, fontSize: 14, letterSpacing: -0.3, color: colors.ink,
  },
  typeSub: { fontFamily: fonts.body, fontSize: 11, color: colors.smoke, marginTop: 2 },
  checkBadge: {
    position: 'absolute', top: 10, right: 10,
    width: 18, height: 18, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
  },

  infoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, backgroundColor: colors.paper,
    borderRadius: radii.card, borderWidth: 1, borderColor: colors.line,
  },
  locationTitle: {
    fontFamily: fonts.displayBold, fontSize: 16, letterSpacing: -0.3,
    color: colors.ink, textTransform: 'uppercase',
  },

  radiusHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12, gap: 10,
  },
  radiusValue: {
    fontFamily: fonts.displayBold, fontSize: 18,
    color: colors.clay, letterSpacing: -0.5,
  },
  track: { height: 24, justifyContent: 'center' },
  trackBase: {
    position: 'absolute', left: 0, right: 0,
    height: 4, borderRadius: 2, backgroundColor: colors.lineStrong,
  },
  trackFill: {
    position: 'absolute', left: 0,
    height: 4, borderRadius: 2, backgroundColor: colors.clay,
  },
  thumb: {
    position: 'absolute', width: 20, height: 20, borderRadius: 999,
    backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.clay,
  },
  radiusEnds: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 8,
  },

  notifRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 14, backgroundColor: colors.paper,
    borderRadius: radii.card, borderWidth: 1, borderColor: colors.line,
  },
  notifLabel: {
    fontFamily: fonts.displayBold, fontSize: 13, letterSpacing: -0.2, color: colors.ink,
  },
  notifSub: {
    fontFamily: fonts.body, fontSize: 11, color: colors.smoke, marginTop: 2,
  },
})
