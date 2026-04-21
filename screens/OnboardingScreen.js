import { useRef, useState } from 'react'
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import RunCardPreview from './onboarding/RunCardPreview'
import { registerForPushNotificationsAsync, savePushToken } from '../lib/notifications'

const { width } = Dimensions.get('window')
const TOTAL_STEPS = 5

export default function OnboardingScreen({ onComplete, userId }) {
  const [step, setStep] = useState(0)
  const [bio, setBio] = useState('')
  const [city, setCity] = useState('')
  const [gender, setGender] = useState(null)
  const [saving, setSaving] = useState(false)
  const scrollRef = useRef(null)

  function goToStep(index) {
    setStep(index)
    scrollRef.current?.scrollTo({ x: index * width, animated: true })
  }

  function nextStep() {
    if (step < TOTAL_STEPS - 1) {
      goToStep(step + 1)
    } else {
      handleComplete()
    }
  }

  function skipStep() {
    nextStep()
  }

  async function handleComplete() {
  setSaving(true)
  try {
    // Request permissions at completion
    const token = await registerForPushNotificationsAsync()
    if (token) {
      await savePushToken(userId, token)
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        bio: bio.trim(),
        city: city.trim(),
        gender: gender,
      })
      .eq('id', userId)

    if (error) throw error
    onComplete()
  } catch (error) {
    Alert.alert('Error', 'Could not save profile')
  } finally {
    setSaving(false)
  }
}

  function renderDots() {
    return (
      <View style={styles.dotsRow}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
        ))}
      </View>
    )
  }

  const genderOptions = [
    { label: 'Woman', value: 'woman' },
    { label: 'Man', value: 'man' },
    { label: 'Non-binary', value: 'non_binary' },
    { label: 'Prefer not to say', value: 'prefer_not_to_say' },
  ]

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          scrollEnabled={true}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onMomentumScrollEnd={(e) => {
            const newIndex = Math.round(e.nativeEvent.contentOffset.x / width)
            setStep(newIndex)
          }}
          style={{ flex: 1 }}
        >

          {/* ── Step 0: Welcome ── */}
          <ScrollView
            style={{ width }}
            contentContainerStyle={styles.welcomeScrollContent}
            showsVerticalScrollIndicator={false}
            scrollEnabled={true}
          >
            <View style={styles.welcomeTop}>
              <Text style={styles.welcomeWordmark}>
                fl<Text style={styles.ember}>o</Text>c
              </Text>
              <Text style={styles.welcomeTagline}>Find your floc.</Text>
              <Text style={styles.welcomeDesc}>
                Connect with runners in your city. Find training partners, discover new routes, and never run alone again.
              </Text>
            </View>
            <View style={styles.cardWrapper}>
              <RunCardPreview />
            </View>
          </ScrollView>

          {/* ── Step 1: Bio ── */}
          <ScrollView
            style={{ width }}
            contentContainerStyle={styles.stepScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.stepTitle}>Tell us{'\n'}about you</Text>
            <Text style={styles.stepSubtitle}>
              Your bio is shown to runners when they view your profile.
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder="I run 4 days a week, love trails and tempo work..."
              placeholderTextColor="#AAA"
              multiline
              maxLength={200}
            />
          </ScrollView>

          {/* ── Step 2: City ── */}
          <ScrollView
            style={{ width }}
            contentContainerStyle={styles.stepScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.stepTitle}>Where{'\n'}do you run?</Text>
            <Text style={styles.stepSubtitle}>
              We'll show you runs in your city first.
            </Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="New York, Paris, London..."
              placeholderTextColor="#AAA"
              returnKeyType="done"
            />
          </ScrollView>

          {/* ── Step 3: Gender ── */}
          <ScrollView
            style={{ width }}
            contentContainerStyle={styles.stepScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.stepTitle}>About{'\n'}you</Text>
            <Text style={styles.stepSubtitle}>
              Gender is optional and used only for safety features — like women-only runs.
            </Text>
            <View style={styles.genderOptions}>
              {genderOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.genderButton,
                    gender === opt.value && styles.genderButtonActive,
                  ]}
                  onPress={() => setGender(opt.value)}
                >
                  <Text style={[
                    styles.genderButtonText,
                    gender === opt.value && styles.genderButtonTextActive,
                  ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* ── Step 4: Notifications ── */}
          <ScrollView
            style={{ width }}
            contentContainerStyle={styles.stepScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.stepTitle}>Stay{'\n'}in the loop</Text>
            <Text style={styles.stepSubtitle}>
              Get notified when someone joins your run, when you're promoted from a waitlist, or when there's a new comment.
            </Text>
            <View style={styles.notifCard}>
              <View style={styles.notifRow}>
                <Ionicons name="checkmark-circle" size={24} color="#C4562A" />
                <Text style={styles.notifText}>You're in the floc</Text>
              </View>
              <View style={styles.notifRow}>
                <Ionicons name="person-add" size={24} color="#C4562A" />
                <Text style={styles.notifText}>Thomas joined your run</Text>
              </View>
              <View style={styles.notifRow}>
                <Ionicons name="chatbubble-outline" size={24} color="#C4562A" />
                <Text style={styles.notifText}>New comment on Sunday Loop</Text>
              </View>
            </View>
          </ScrollView>

        </ScrollView>

        {/* ── Shared footer ── */}
        <View style={styles.footer}>
          {renderDots()}
          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
            onPress={step === TOTAL_STEPS - 1 ? handleComplete : nextStep}
            disabled={saving}
          >
            <Text style={styles.primaryButtonText}>
              {step === TOTAL_STEPS - 1
                ? (saving ? 'Setting up...' : "Let's run")
                : 'Next'
              }
            </Text>
          </TouchableOpacity>
          {step > 0 && step < TOTAL_STEPS - 1 && (
            <TouchableOpacity style={styles.skipButton} onPress={skipStep}>
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0EA',
  },

  // Welcome
  welcomeScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  welcomeTop: {
    marginBottom: 32,
  },
  welcomeWordmark: {
    fontSize: 64,
    fontWeight: '700',
    color: '#1A0F0A',
    letterSpacing: -2,
    marginBottom: 8,
  },
  ember: {
    color: '#C4562A',
  },
  welcomeTagline: {
    fontSize: 20,
    fontStyle: 'italic',
    color: '#C4562A',
    marginBottom: 16,
  },
  welcomeDesc: {
    fontSize: 16,
    color: '#8A7060',
    lineHeight: 24,
  },
  cardWrapper: {
    marginHorizontal: 4,
  },

  // Steps
  stepScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
  },
  stepTitle: {
    fontSize: 40,
    fontWeight: '800',
    color: '#1A0F0A',
    letterSpacing: -1,
    marginBottom: 16,
    lineHeight: 48,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#8A7060',
    lineHeight: 24,
    marginBottom: 32,
  },

  // Input
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E8E0D8',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: '#1A0F0A',
  },
  textArea: {
    height: 140,
    textAlignVertical: 'top',
  },

  // Gender
  genderOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  genderButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E8E0D8',
  },
  genderButtonActive: {
    backgroundColor: '#1A0F0A',
    borderColor: '#1A0F0A',
  },
  genderButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8A7060',
  },
  genderButtonTextActive: {
    color: 'white',
  },

  // Notifications
  notifCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: '#E8E0D8',
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  notifText: {
    fontSize: 15,
    color: '#1A0F0A',
    fontWeight: '500',
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    gap: 12,
    backgroundColor: '#F5F0EA',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E8E0D8',
  },
  dotActive: {
    backgroundColor: '#C4562A',
    width: 24,
  },
  primaryButton: {
    backgroundColor: '#C4562A',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
  },
  skipButton: {
    alignItems: 'center',
    padding: 8,
  },
  skipButtonText: {
    fontSize: 15,
    color: '#8A7060',
  },
})