// v4 Profile. Modal sheet on cream with a restrained top bar (close + "PROFILE"
// micro + save state), large avatar with camera nub, InputField inputs,
// gender pill row, notifications toggle with label, email as readonly, and a
// sticky clay Save CTA with a ghost Log Out beneath.

import { useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal,
  Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { updateNotificationSettings } from '../lib/notifications'
import { colors, fonts, radii, space } from '../lib/theme'
import InputField from '../components/ui/InputField'
import Button from '../components/ui/Button'
import MicroLabel from '../components/ui/MicroLabel'

const GENDERS = [
  { key: 'woman', label: 'Woman' },
  { key: 'man', label: 'Man' },
  { key: 'non_binary', label: 'Non-binary' },
  { key: 'prefer_not_to_say', label: 'Prefer not to say' },
]

export default function ProfileScreen({ visible, onClose, userId }) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [profile, setProfile] = useState(null)
  const [fullName, setFullName] = useState('')
  const [city, setCity] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [gender, setGender] = useState(null)

  useEffect(() => {
    if (visible && userId) loadProfile()
  }, [visible, userId])

  async function loadProfile() {
    if (!userId) { setLoading(false); return }
    try {
      setLoading(true)
      const [{ data: profileData, error }, { data: { user } }] = await Promise.all([
        supabase.from('profiles')
          .select('full_name, city, bio, avatar_url, notifications_enabled, gender')
          .eq('id', userId).maybeSingle(),
        supabase.auth.getUser(),
      ])
      if (error) throw error
      setFullName(profileData?.full_name || '')
      setCity(profileData?.city || '')
      setBio(profileData?.bio || '')
      setAvatarUrl(profileData?.avatar_url ?? null)
      setNotificationsEnabled(profileData?.notifications_enabled ?? true)
      setGender(profileData?.gender ?? null)
      setProfile({ ...(profileData || {}), email: user?.email, id: userId })
    } catch (error) {
      console.error('Error loading profile:', error)
      Alert.alert('Error', 'Could not load profile')
    } finally { setLoading(false) }
  }

  async function pickImage() {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photos to upload a profile picture.')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true,
      })
      if (!result.canceled) await uploadAvatar(result.assets[0].uri, result.assets[0].base64)
    } catch (error) {
      Alert.alert('Error', 'Could not pick image')
      console.error('Pick image error:', error)
    }
  }

  async function uploadAvatar(uri, base64) {
    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const timestamp = Date.now()
      const fileName = `${user.id}/avatar-${timestamp}.jpg`
      const binaryString = atob(base64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)
      const { error: uploadError } = await supabase.storage.from('avatars')
        .upload(fileName, bytes.buffer, { contentType: 'image/jpeg' })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
      const publicUrl = data.publicUrl
      const { error: updateError } = await supabase.from('profiles')
        .update({ avatar_url: publicUrl }).eq('id', user.id)
      if (updateError) throw updateError
      setAvatarUrl(publicUrl)
      setProfile({ ...profile, avatar_url: publicUrl })
    } catch (error) {
      Alert.alert('Error', error.message)
      console.error('Upload avatar error:', error)
    } finally { setUploading(false) }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('profiles')
        .update({
          full_name: fullName.trim(),
          city: city.trim(),
          bio: bio.trim(),
          notifications_enabled: notificationsEnabled,
          gender,
        })
        .eq('id', user.id)
      if (error) throw error
      onClose()
    } catch (error) {
      Alert.alert('Error', error.message)
    } finally { setSaving(false) }
  }

  function handleSignOut() {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: async () => {
        const { error } = await supabase.auth.signOut()
        if (error) Alert.alert('Error', error.message)
      } },
    ])
  }

  async function toggleNotifications() {
    const newValue = !notificationsEnabled
    setNotificationsEnabled(newValue)
    const success = await updateNotificationSettings(profile?.id || userId, newValue)
    if (!success) {
      setNotificationsEnabled(!newValue)
      Alert.alert('Error', 'Could not update notification settings')
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: colors.cream }}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={onClose} style={styles.closeBox} hitSlop={10}>
            <Ionicons name="close" size={16} color={colors.ink} />
          </Pressable>
          <MicroLabel color={colors.smoke}>PROFILE</MicroLabel>
          <View style={{ width: 34 }} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.clay} />
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Hero block: avatar + name preview */}
            <View style={styles.hero}>
              <Pressable onPress={pickImage} style={styles.avatarTouch} disabled={uploading}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImage} key={avatarUrl} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarText}>
                      {(fullName || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                {uploading ? (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator size="small" color={colors.cream} />
                  </View>
                ) : (
                  <View style={styles.cameraNub}>
                    <Ionicons name="camera" size={14} color={colors.cream} />
                  </View>
                )}
              </Pressable>
              <View style={styles.heroMicroRow}>
                <View style={styles.heroDot} />
                <Text style={styles.heroMicro}>TAP TO CHANGE PHOTO</Text>
              </View>
              {fullName ? (
                <Text style={styles.heroName}>{fullName}</Text>
              ) : null}
              {city ? (
                <Text style={styles.heroCity}>{city.toUpperCase()}</Text>
              ) : null}
            </View>

            {/* Fields */}
            <View style={styles.fields}>
              <InputField
                label="FULL NAME"
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your name"
                autoCapitalize="words"
              />
              <InputField
                label="CITY"
                value={city}
                onChangeText={setCity}
                placeholder="Brooklyn, San Francisco…"
                autoCapitalize="words"
                style={styles.field}
              />
              <InputField
                label="BIO"
                value={bio}
                onChangeText={setBio}
                placeholder="Tell other runners about yourself…"
                multiline
                numberOfLines={4}
                style={styles.field}
                inputStyle={styles.bioInput}
              />
            </View>

            {/* Gender */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>GENDER</Text>
              <Text style={styles.sectionHelper}>
                Optional. Helps us show gender-specific runs when filtering.
              </Text>
              <View style={styles.pillRow}>
                {GENDERS.map((g) => {
                  const active = gender === g.key
                  return (
                    <Pressable
                      key={g.key}
                      onPress={() => setGender(active ? null : g.key)}
                      style={[styles.pill, active && styles.pillActive]}
                    >
                      <Text style={[styles.pillText, active && styles.pillTextActive]}>
                        {g.label.toUpperCase()}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>

            {/* Notifications */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
              <View style={styles.notifCard}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.notifTitle}>Daily digest</Text>
                  <Text style={styles.notifSub}>
                    A short summary of new runs in your city, each morning.
                  </Text>
                </View>
                <Pressable
                  onPress={toggleNotifications}
                  style={[styles.toggle, notificationsEnabled && styles.toggleOn]}
                >
                  <View style={[styles.toggleThumb, notificationsEnabled && styles.toggleThumbOn]} />
                </Pressable>
              </View>
            </View>

            {/* Email */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>EMAIL</Text>
              <View style={styles.emailBox}>
                <Text style={styles.emailText}>{profile?.email}</Text>
              </View>
            </View>

            {/* Footer (lives at end of scroll, not sticky) */}
            <View style={styles.footer}>
              <Button onPress={handleSave} loading={saving} variant="primary">
                Save Changes
              </Button>
              <Pressable onPress={handleSignOut} style={styles.logoutBtn}>
                <Ionicons name="log-out-outline" size={14} color={colors.clay} />
                <Text style={styles.logoutText}>LOG OUT</Text>
              </Pressable>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm,
  },
  closeBox: {
    width: 34, height: 34, borderRadius: radii.chip,
    borderWidth: 1, borderColor: colors.lineStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: space.xl, paddingBottom: space.xl },

  hero: {
    alignItems: 'center', paddingTop: space.md, paddingBottom: space.xl,
  },
  avatarTouch: { position: 'relative' },
  avatarImage: {
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 3, borderColor: colors.paper,
  },
  avatarFallback: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.paper,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.displayBold, fontSize: 44, color: colors.cream },
  cameraNub: {
    position: 'absolute', bottom: 2, right: 2,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.clay, borderWidth: 3, borderColor: colors.cream,
    alignItems: 'center', justifyContent: 'center',
  },
  uploadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(24,20,16,0.5)', borderRadius: 60,
    alignItems: 'center', justifyContent: 'center',
  },
  heroMicroRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14,
  },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.clay },
  heroMicro: {
    fontFamily: fonts.displayBold, fontSize: 10,
    letterSpacing: 1.8, color: colors.clay,
  },
  heroName: {
    fontFamily: fonts.displayBold, fontSize: 28, lineHeight: 30,
    letterSpacing: -1, color: colors.ink, textTransform: 'uppercase',
    textAlign: 'center', marginTop: 10,
  },
  heroCity: {
    fontFamily: fonts.displayBold, fontSize: 11,
    letterSpacing: 1.8, color: colors.smoke, marginTop: 4,
  },

  fields: { gap: 0 },
  field: { marginTop: space.md },
  bioInput: { height: 100, textAlignVertical: 'top' },

  section: { marginTop: space.xl },
  sectionLabel: {
    fontFamily: fonts.displayBold, fontSize: 10,
    letterSpacing: 2, color: colors.smoke, marginBottom: 6,
  },
  sectionHelper: {
    fontFamily: fonts.body, fontSize: 13, color: colors.smoke, marginBottom: 12,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 14, height: 36, borderRadius: radii.chip,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.paper,
  },
  pillActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  pillText: {
    fontFamily: fonts.displayBold, fontSize: 10,
    letterSpacing: 1.6, color: colors.ink,
  },
  pillTextActive: { color: colors.cream },

  notifCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: space.md, backgroundColor: colors.paper,
    borderRadius: radii.card, borderWidth: 1, borderColor: colors.line,
  },
  notifTitle: {
    fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.ink, marginBottom: 2,
  },
  notifSub: { fontFamily: fonts.body, fontSize: 13, color: colors.smoke, lineHeight: 18 },
  toggle: {
    width: 48, height: 28, borderRadius: 14,
    backgroundColor: colors.lineStrong, padding: 2, justifyContent: 'center',
  },
  toggleOn: { backgroundColor: colors.clay },
  toggleThumb: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: colors.cream,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12, shadowRadius: 2, elevation: 2,
  },
  toggleThumbOn: { transform: [{ translateX: 20 }] },

  emailBox: {
    paddingVertical: 14, paddingHorizontal: space.md,
    backgroundColor: colors.paper, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.line,
  },
  emailText: { fontFamily: fonts.body, fontSize: 15, color: colors.smoke },

  footer: {
    marginTop: space.xxl,
    gap: 12,
  },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 44, borderRadius: radii.button,
    borderWidth: 1, borderColor: 'rgba(194,74,46,0.25)',
    backgroundColor: 'rgba(194,74,46,0.06)',
  },
  logoutText: {
    fontFamily: fonts.displayBold, fontSize: 11,
    letterSpacing: 1.6, color: colors.clay,
  },
})
