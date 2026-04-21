import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, View, Dimensions } from 'react-native'

const { width } = Dimensions.get('window')

export default function SplashAnimationScreen({ onFinished }) {
  const flOpacity = useRef(new Animated.Value(0)).current
  const flTranslate = useRef(new Animated.Value(-30)).current
  const cOpacity = useRef(new Animated.Value(0)).current
  const cTranslate = useRef(new Animated.Value(30)).current
  const oOpacity = useRef(new Animated.Value(0)).current
  const oScale = useRef(new Animated.Value(0.6)).current
  const taglineOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.sequence([
      // fl and c slide in simultaneously
      Animated.parallel([
        Animated.timing(flOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(flTranslate, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(cOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(cTranslate, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      // Brief pause
      Animated.delay(100),
      // o appears — the floc moment
      Animated.parallel([
        Animated.timing(oOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.spring(oScale, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
      ]),
      // Tagline fades in
      Animated.delay(150),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      // Hold
      Animated.delay(700),
    ]).start(() => {
      onFinished()
    })
  }, [])

  return (
    <View style={styles.container}>
      <View style={styles.wordmarkRow}>
        {/* fl — slides from left */}
        <Animated.Text
          style={[
            styles.wordmark,
            styles.mist,
            {
              opacity: flOpacity,
              transform: [{ translateX: flTranslate }],
            },
          ]}
        >
          fl
        </Animated.Text>

        {/* o — fades and scales in — ember */}
        <Animated.Text
          style={[
            styles.wordmark,
            styles.ember,
            {
              opacity: oOpacity,
              transform: [{ scale: oScale }],
            },
          ]}
        >
          o
        </Animated.Text>

        {/* c — slides from right */}
        <Animated.Text
          style={[
            styles.wordmark,
            styles.mist,
            {
              opacity: cOpacity,
              transform: [{ translateX: cTranslate }],
            },
          ]}
        >
          c
        </Animated.Text>
      </View>

      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        Find your floc.
      </Animated.Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A0F0A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  wordmark: {
    fontSize: 80,
    fontWeight: '700',
    letterSpacing: -2,
  },
  mist: {
    color: '#F5EFE8',
  },
  ember: {
    color: '#C4562A',
  },
  tagline: {
    marginTop: 16,
    fontSize: 18,
    color: '#C4562A',
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },
})