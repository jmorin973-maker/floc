// Floc v4 animated splash. 3-second loop per the design handoff.
// 0–70%: 8 satellite dots travel inward.
// 70–100%: center dot pulses; 3 dashed rings fade in.
// Bottom: 3 phased loading dots.

import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated, Easing } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { colors, fonts } from '../lib/theme'
import FlocLogo from '../components/ui/FlocLogo'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

const SATELLITES = [
  { dx: -95, dy: -70 }, { dx: 80,  dy: -90 }, { dx: 100, dy: 50 },
  { dx: -80, dy: 70  }, { dx: -110, dy: 10 }, { dx: 110, dy: -20 },
  { dx: -40, dy: -100}, { dx: 40,  dy: 100 },
]

export default function SplashAnimationScreen({ onFinished }) {
  const t = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(t, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: false })
    )
    loop.start()
    const autoDismiss = setTimeout(() => onFinished && onFinished(), 2500)
    return () => { loop.stop(); clearTimeout(autoDismiss) }
  }, [])

  const eased = t.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' })
  const pulse = t.interpolate({ inputRange: [0, 0.7, 0.85, 1], outputRange: [0, 0, 1, 0], extrapolate: 'clamp' })

  const ring1Opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.30] })
  const ring2Opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] })
  const ring3Opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.14] })
  const centerR = pulse.interpolate({ inputRange: [0, 1], outputRange: [18, 23] })
  const centerOpacity = eased.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] })

  const dot0 = t.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: [0.3, 1, 0.3, 0.3] })
  const dot1 = t.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: [0.3, 0.3, 1, 0.3] })
  const dot2 = t.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: [1, 0.3, 0.3, 1] })

  return (
    <View style={styles.root}>
      <View style={styles.svgWrap}>
        <Svg width={280} height={280} viewBox="-140 -140 280 280">
          <AnimatedCircle cx="0" cy="0" r={50}  fill="none" stroke={colors.clay} strokeWidth={1} strokeDasharray="3 4" opacity={ring1Opacity} />
          <AnimatedCircle cx="0" cy="0" r={85}  fill="none" stroke={colors.clay} strokeWidth={1} strokeDasharray="3 4" opacity={ring2Opacity} />
          <AnimatedCircle cx="0" cy="0" r={120} fill="none" stroke={colors.clay} strokeWidth={1} strokeDasharray="3 4" opacity={ring3Opacity} />

          {SATELLITES.map((d, i) => (
            <SatelliteDot key={i} dx={d.dx} dy={d.dy} eased={eased} />
          ))}

          <AnimatedCircle cx="0" cy="0" r={centerR} fill={colors.clay} opacity={centerOpacity} />
        </Svg>
      </View>

      <Animated.View style={{ opacity: eased, marginTop: 24, alignItems: 'center' }}>
        <FlocLogo size={40} color={colors.cream} accent={colors.clay} />
        <Text style={styles.tagline}>FIND YOUR FLOCK.</Text>
      </Animated.View>

      <View style={styles.loadingRow}>
        <Animated.View style={[styles.loadingDot, { opacity: dot0 }]} />
        <Animated.View style={[styles.loadingDot, { opacity: dot1 }]} />
        <Animated.View style={[styles.loadingDot, { opacity: dot2 }]} />
      </View>
    </View>
  )
}

function SatelliteDot({ dx, dy, eased }) {
  const cx = eased.interpolate({ inputRange: [0, 1], outputRange: [dx, 0] })
  const cy = eased.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] })
  const r  = eased.interpolate({ inputRange: [0, 1], outputRange: [4, 6] })
  const op = eased.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.9] })
  return <AnimatedCircle cx={cx} cy={cy} r={r} fill={colors.clay} opacity={op} />
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  svgWrap: { width: 280, height: 280, alignItems: 'center', justifyContent: 'center' },
  tagline: {
    marginTop: 14,
    fontFamily: fonts.displayBold,
    fontSize: 12,
    letterSpacing: 2.4,
    color: 'rgba(244,236,223,0.6)',
  },
  loadingRow: {
    position: 'absolute',
    bottom: 60,
    flexDirection: 'row',
    gap: 6,
  },
  loadingDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: colors.clay },
})
