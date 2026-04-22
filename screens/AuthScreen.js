// v4 auth screen: Sign In / Sign Up in one flow, toggleable.
// Design matches SignInV4 + SignUpV4 in the handoff.

import { useState } from 'react'
import {
  Alert, KeyboardAvoidingView, Platform, Pressable,
  SafeAreaView, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { colors, fonts, space, radii, type } from '../lib/theme'
import InputField from '../components/ui/InputField'
import Button from '../components/ui/Button'
import MicroLabel from '../components/ui/MicroLabel'

export default function AuthScreen() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState({})

  const isSignUp = mode === 'signup'

  function validate() {
    const e = {}
    if (isSignUp && name.trim().length < 2) e.name = 'Name must be at least 2 characters.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Enter a valid email.'
    if (password.length < 8) e.password = 'At least 8 characters.'
    else if (isSignUp && !(/[A-Za-z]/.test(password) && /[0-9]/.test(password))) e.password = 'Include a letter and a number.'
    setError(e)
    return Object.keys(e).length === 0
  }

  async function submit() {
    if (!validate()) return
    setLoading(true)
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() } },
        })
        if (error) throw error
        Alert.alert('Check your inbox', 'We sent you a confirmation link.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) throw error
      }
    } catch (err) {
      Alert.alert('Error', err?.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.topBar}>
          <View style={styles.closeBox}>
            <Ionicons name="close" size={16} color={colors.ink} />
          </View>
          <MicroLabel color={colors.smoke}>{isSignUp ? 'Create Account' : 'Sign In'}</MicroLabel>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroMicro}>
              <View style={styles.heroDot} />
              <Text style={styles.heroMicroText}>
                {isSignUp ? 'NEW HERE' : 'WELCOME BACK'}
              </Text>
            </View>
            {isSignUp ? (
              <Text style={styles.heroTitle}>
                Join the{'\n'}<Text style={styles.heroAccent}>flock.</Text>
              </Text>
            ) : (
              <Text style={styles.heroTitle}>
                Lace{'\n'}<Text style={styles.heroAccent}>up.</Text>
              </Text>
            )}
            {isSignUp ? (
              <Text style={styles.heroSub}>
                We'll need a name and email. That's it. No profile pic, no bio.
              </Text>
            ) : null}
          </View>

          <View style={styles.fields}>
            {isSignUp ? (
              <InputField
                label="NAME"
                value={name}
                onChangeText={(v) => { setName(v); setError((e) => ({ ...e, name: undefined })) }}
                placeholder="Julien M."
                autoCapitalize="words"
                error={error.name}
              />
            ) : null}
            <InputField
              label="EMAIL"
              value={email}
              onChangeText={(v) => { setEmail(v); setError((e) => ({ ...e, email: undefined })) }}
              placeholder="you@floc.run"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={error.email}
              style={styles.field}
            />
            <InputField
              label="PASSWORD"
              value={password}
              onChangeText={(v) => { setPassword(v); setError((e) => ({ ...e, password: undefined })) }}
              placeholder="••••••••••"
              secureTextEntry
              error={error.password}
              style={styles.field}
              rightSlot={!isSignUp ? (
                <Pressable onPress={() => Alert.alert('Forgot password', 'Password reset coming soon.')}>
                  <Text style={styles.forgot}>FORGOT?</Text>
                </Pressable>
              ) : null}
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button onPress={submit} loading={loading} iconRight={<Ionicons name="arrow-forward" size={14} color={colors.cream} />}>
            {isSignUp ? 'Create Account' : 'Sign In'}
          </Button>
          <Pressable onPress={() => { setMode(isSignUp ? 'signin' : 'signup'); setError({}) }} style={styles.toggle}>
            <Text style={styles.toggleText}>
              {isSignUp ? 'Already have an account? ' : 'New to Floc? '}
              <Text style={styles.toggleTextBold}>
                {isSignUp ? 'Sign in' : 'Create account'}
              </Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.md,
  },
  closeBox: {
    width: 34, height: 34,
    borderRadius: radii.chip,
    borderWidth: 1, borderColor: colors.lineStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  scroll: { paddingHorizontal: space.xl, paddingBottom: 180 },
  hero: { paddingTop: space.lg, paddingBottom: space.xl },
  heroMicro: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.clay },
  heroMicroText: {
    fontFamily: fonts.displayBold,
    fontSize: 10, letterSpacing: 1.8, color: colors.clay,
  },
  heroTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 42, lineHeight: 42 * 0.9,
    letterSpacing: -2, color: colors.ink,
    textTransform: 'uppercase',
  },
  heroAccent: { color: colors.clay },
  heroSub: { ...type.body, color: colors.smoke, marginTop: space.sm, maxWidth: 340 },
  fields: { gap: space.md },
  field: { marginTop: space.md },
  forgot: {
    fontFamily: fonts.displayBold,
    fontSize: 10, letterSpacing: 1.6, color: colors.clay,
    paddingHorizontal: 4,
  },
  footer: {
    position: 'absolute',
    left: space.xl, right: space.xl, bottom: space.xl,
  },
  toggle: { marginTop: space.md, alignItems: 'center' },
  toggleText: { fontFamily: fonts.body, fontSize: 13, color: colors.smoke },
  toggleTextBold: { fontFamily: fonts.bodySemibold, color: colors.ink },
})
