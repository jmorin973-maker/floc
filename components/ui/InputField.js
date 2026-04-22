// Paper-background input with a 9px uppercase tracked label above it.
// Border is `line` at rest, `lineStrong` on focus or when `focused` is forced.

import { useState } from 'react'
import { View, TextInput, Text, StyleSheet, Pressable } from 'react-native'
import { colors, radii, fonts, space, type } from '../../lib/theme'
import MicroLabel from './MicroLabel'

export default function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  autoCorrect = false,
  error,
  rightSlot,
  leftSlot,
  forceFocused,
  inputStyle,
  style,
  ...rest
}) {
  const [focused, setFocused] = useState(false)
  const isFocused = forceFocused ?? focused

  return (
    <View style={[styles.wrap, style]}>
      {label ? <MicroLabel size="sm" color={isFocused ? colors.clay : colors.smoke} style={styles.label}>{label}</MicroLabel> : null}
      <View style={[styles.box, isFocused && styles.boxFocused, !!error && styles.boxError]}>
        {leftSlot ? <View style={styles.slot}>{leftSlot}</View> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.smoke}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          selectionColor={colors.clay}
          cursorColor={colors.clay}
          style={[styles.input, inputStyle]}
          {...rest}
        />
        {rightSlot ? <View style={styles.slot}>{rightSlot}</View> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  label: { marginBottom: 8 },
  box: {
    backgroundColor: colors.paper,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: space.md,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
  },
  boxFocused: { borderColor: colors.lineStrong },
  boxError: { borderColor: colors.clay },
  slot: { marginHorizontal: 4 },
  input: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  error: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.clay,
    marginTop: 6,
  },
})
