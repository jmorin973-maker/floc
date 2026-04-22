// Shared shell for all 5 onboarding steps.
// Layout:
//   step indicator "01 / 05" top-left · "Skip" top-right
//   38px hero title
//   optional subtitle in smoke
//   scrollable content
//   5-segment progress strip ~80px from bottom
//   ink (not clay) primary CTA at bottom

import { SafeAreaView, View, Text, ScrollView, StyleSheet, Pressable } from 'react-native'
import { colors, fonts, space, type } from '../../lib/theme'
import MicroLabel from './MicroLabel'
import ProgressStrip from './ProgressStrip'
import Button from './Button'

export default function OnboardingShell({
  step,
  total,
  title,
  subtitle,
  children,
  onSkip,
  onNext,
  ctaLabel = 'CONTINUE →',
  ctaDisabled,
  ctaLoading,
}) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <MicroLabel color={colors.smoke}>{pad(step)} / {pad(total)}</MicroLabel>
        {onSkip ? (
          <Pressable onPress={onSkip}><MicroLabel color={colors.smoke}>Skip</MicroLabel></Pressable>
        ) : <View />}
      </View>

      <View style={styles.heroWrap}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>

      <View style={styles.footer}>
        <ProgressStrip current={step} total={total} style={{ marginBottom: space.xl }} />
        <Button variant="ink" onPress={onNext} disabled={ctaDisabled} loading={ctaLoading}>
          {ctaLabel}
        </Button>
      </View>
    </SafeAreaView>
  )
}

function pad(n) { return String(n).padStart(2, '0') }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingTop: space.xs,
    paddingBottom: space.md,
  },
  heroWrap: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.xl },
  title: { ...type.hero, fontSize: 38, color: colors.ink, lineHeight: 40 },
  subtitle: {
    ...type.body,
    color: colors.smoke,
    marginTop: space.sm,
    fontSize: 15,
    lineHeight: 22,
  },
  scroll: { paddingHorizontal: space.xl, paddingBottom: space.xxl },
  footer: { paddingHorizontal: space.xl, paddingBottom: space.xl, paddingTop: space.sm },
})
