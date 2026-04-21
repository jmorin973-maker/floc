import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { updateNotificationSettings } from '../lib/notifications'
import AsyncStorage from '@react-native-async-storage/async-storage'

export default function ProfileScreen({ visible, onClose, onLogout, userProfile, onProfileUpdate, userId }) {
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
    if (visible && userId) {
      loadProfile()
    }
  }, [visible, userId])

  async function loadProfile() {
  if (!userId) {
    setLoading(false)
    return
  }
  
  try {
    setLoading(true)
    const [{ data: profileData, error }, { data: { user } }] = await Promise.all([
      supabase
        .from('profiles')
        .select('full_name, city, bio, avatar_url, notifications_enabled, gender')
        .eq('id', userId)
        .maybeSingle(),
      supabase.auth.getUser()
    ])

    if (error) throw error

    setFullName(profileData?.full_name || '')
    setCity(profileData?.city || '')
    setBio(profileData?.bio || '')
    setAvatarUrl(profileData?.avatar_url ?? null)
    setNotificationsEnabled(profileData?.notifications_enabled ?? true)
    setGender(profileData?.gender ?? null)
    setProfile({ ...(profileData || {}), email: user?.email })
  } catch (error) {
    console.error('Error loading profile:', error)
    Alert.alert('Error', 'Could not load profile')
  } finally {
    setLoading(false)
  }
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
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      })

      if (!result.canceled) {
        await uploadAvatar(result.assets[0].uri, result.assets[0].base64)
      }
    } catch (error) {
      Alert.alert('Error', 'Could not pick image')
      console.error('Pick image error:', error)
    }
  }

  async function uploadAvatar(uri, base64) {
    setUploading(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const fileExt = 'jpg'
      const timestamp = new Date().getTime()
      const fileName = `${user.id}/avatar-${timestamp}.${fileExt}`

      const binaryString = atob(base64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, bytes.buffer, {
          contentType: 'image/jpeg'
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        throw uploadError
      }

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      const publicUrl = data.publicUrl

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)

      if (updateError) throw updateError

      setAvatarUrl(publicUrl)
      setProfile({ ...profile, avatar_url: publicUrl })
      
      Alert.alert('Success', 'Profile picture updated!')
    } catch (error) {
      Alert.alert('Error', error.message)
      console.error('Upload avatar error:', error)
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          city: city.trim(),
          bio: bio.trim(),
          notifications_enabled: notificationsEnabled,
          gender: gender,
        })
        .eq('id', user.id)

      if (error) throw error

      Alert.alert('Success', 'Profile updated!')
      onClose()
    } catch (error) {
      Alert.alert('Error', error.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut()
    if (error) {
      Alert.alert('Error', error.message)
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeButton}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Profile</Text>
            <View style={{ width: 60 }} />
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#C4562A" />
            </View>
          ) : (
            <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
              <View style={styles.avatarContainer}>
                <TouchableOpacity 
                  onPress={pickImage} 
                  style={styles.avatarTouchable}
                  disabled={uploading}
                >
                  {avatarUrl ? (
                    <Image 
                      source={{ uri: avatarUrl }} 
                      style={styles.avatarImage}
                      key={avatarUrl}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {fullName?.charAt(0)?.toUpperCase() || '?'}
                      </Text>
                    </View>
                  )}
                  {uploading ? (
                    <View style={styles.uploadingOverlay}>
                      <ActivityIndicator size="small" color="#FFF" />
                    </View>
                  ) : (
                    <View style={styles.cameraIconContainer}>
                      <Ionicons name="camera" size={20} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
                <Text style={styles.avatarHint}>Tap to change photo</Text>
              </View>

              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your name"
                placeholderTextColor="#AAA"
              />

              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder="New York, Brooklyn, San Francisco..."
                placeholderTextColor="#AAA"
              />

              <Text style={styles.label}>Bio</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell other runners about yourself..."
                placeholderTextColor="#AAA"
                multiline
                numberOfLines={4}
              />

          <Text style={styles.label}>Gender (Optional - for safety features)</Text>
            <Text style={styles.helperText}>
              This helps us show you gender-specific runs when filtering
            </Text>
            <View style={styles.genderOptions}>
              <TouchableOpacity
                style={[
                  styles.genderButton,
                  gender === 'woman' && styles.genderButtonActive
                ]}
                onPress={() => setGender('woman')}
              >
                <Text style={[
                  styles.genderButtonText,
                  gender === 'woman' && styles.genderButtonTextActive
                ]}>
                  Woman
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.genderButton,
                  gender === 'man' && styles.genderButtonActive
                ]}
                onPress={() => setGender('man')}
              >
                <Text style={[
                  styles.genderButtonText,
                  gender === 'man' && styles.genderButtonTextActive
                ]}>
                  Man
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.genderButton,
                  gender === 'non_binary' && styles.genderButtonActive
                ]}
                onPress={() => setGender('non_binary')}
              >
                <Text style={[
                  styles.genderButtonText,
                  gender === 'non_binary' && styles.genderButtonTextActive
                ]}>
                  Non-binary
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.genderButton,
                  gender === 'prefer_not_to_say' && styles.genderButtonActive
                ]}
                onPress={() => setGender('prefer_not_to_say')}
              >
                <Text style={[
                  styles.genderButtonText,
                  gender === 'prefer_not_to_say' && styles.genderButtonTextActive
                ]}>
                  Prefer not to say
                </Text>
              </TouchableOpacity>
            </View>

              <View style={styles.notificationSection}>
                <View style={styles.notificationHeader}>
                  <View>
                    <Text style={styles.label}>Notifications</Text>
                    <Text style={styles.notificationSubtext}>
                      Daily digest of new runs in your city
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.toggle,
                      notificationsEnabled && styles.toggleActive
                    ]}
                    onPress={async () => {
                      const newValue = !notificationsEnabled
                      setNotificationsEnabled(newValue)
                      const success = await updateNotificationSettings(profile.id, newValue)
                      if (!success) {
                        setNotificationsEnabled(!newValue)
                        Alert.alert('Error', 'Could not update notification settings')
                      }
                    }}
                  >
                    <View style={[
                      styles.toggleThumb,
                      notificationsEnabled && styles.toggleThumbActive
                    ]} />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.label}>Email</Text>
              <Text style={styles.emailText}>{profile?.email}</Text>

              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                <Text style={styles.signOutButtonText}>Log Out</Text>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0EA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  closeButton: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarTouchable: {
    position: 'relative',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#666',
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#1A0F0A',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#F5F0EA',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarHint: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F0F0F',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#0F0F0F',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  emailText: {
    backgroundColor: '#F8F8F8',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#888',
  },
  notificationSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notificationSubtext: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  toggle: {
    width: 51,
    height: 31,
    borderRadius: 16,
    backgroundColor: '#E8E8E8',
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#10B981',
  },
  toggleThumb: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  saveButton: {
    backgroundColor: '#C4562A',
    padding: 16,
    borderRadius: 12,
    marginTop: 32,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  signOutButton: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    marginTop: 16,
  },
  signOutButtonText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#DC2626',
  },
  helperText: {
    fontSize: 13,
    color: '#999',
    marginBottom: 12,
    marginTop: -8,
  },
  genderOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  genderButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F8F8F8',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  genderButtonActive: {
    backgroundColor: '#1A0F0A',
    borderColor: '#1A0F0A',
  },
  genderButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  genderButtonTextActive: {
    color: 'white',
  },
})