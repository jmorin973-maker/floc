// 3 variants:
//   primary → clay background, cream text (main CTAs)
//   ink     → ink background, cream text (onboarding CTAs, inverse buttons)
//   outline → transparent, lineStrong border, ink text
// Height 48–50, full-width by default.

import { Pressable, Text, StyleSheet, ActivityIndicator, View } from 'react-native'
import { colors, radii, fonts, space } from '../../lib/theme'

export default function Button({
  variant = 'primary',
  onPress,
  disabled,
  loading,
  children,
  style,
  textStyle,
  fullWidth = true,
  iconRight = null,
}) {
  const v = variantStyles[variant] || variantStyles.primary
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        v.container,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text.color} />
      ) : (
        <View style={styles.inner}>
          <Text style={[styles.label, v.text, textStyle]}>{children}</Text>
          {iconRight ? <View style={styles.iconRight}>{iconRight}</View> : null}
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    height: 50,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconRight: { marginLeft: 4 },
  label: {
    fontFamily: fonts.displayBold,
    fontSize: 13,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
})

const variantStyles = {
  primary: {
    container: { backgroundColor: colors.clay },
    text: { color: colors.cream },
  },
  ink: {
    container: { backgroundColor: colors.ink },
    text: { color: colors.cream },
  },
  outline: {
    container: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: colors.lineStrong,
    },
    text: { color: colors.ink },
  },
}
