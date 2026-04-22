// iOS-style pill toggle. 40×24 track, 20px thumb. Clay when on.

import { Pressable, View, StyleSheet } from 'react-native'
import { colors } from '../../lib/theme'

export default function Toggle({ value, onChange, disabled }) {
  return (
    <Pressable
      onPress={() => !disabled && onChange && onChange(!value)}
      disabled={disabled}
      style={[
        styles.track,
        { backgroundColor: value ? colors.clay : colors.lineStrong },
        disabled && styles.disabled,
      ]}
    >
      <View style={[styles.thumb, value && styles.thumbOn]} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  track: {
    width: 44,
    height: 26,
    borderRadius: 999,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  disabled: { opacity: 0.5 },
  thumb: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: colors.paper,
    alignSelf: 'flex-start',
  },
  thumbOn: { alignSelf: 'flex-end' },
})
