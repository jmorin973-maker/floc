import { useState } from 'react'
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native'
import { supabase } from '../lib/supabase'

export default function AuthScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)

  async function signInWithEmail() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    })

    if (error) Alert.alert('Error', error.message)
    setLoading(false)
  }

  async function signUpWithEmail() {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password,
      options: {
        data: {
          full_name: name.trim(),
        }
      }
    })

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      Alert.alert('Success', 'Account created! You can now log in.')
      setIsSignUp(false)
    }
    setLoading(false)
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <Text style={styles.logo}>Floc</Text>
          <Text style={styles.tagline}>Find your pack</Text>

          {isSignUp && (
            <TextInput
              style={styles.input}
              onChangeText={setName}
              value={name}
              placeholder="Full Name"
              autoCapitalize="words"
            />
          )}

          <TextInput
            style={styles.input}
            onChangeText={setEmail}
            value={email}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            style={styles.input}
            onChangeText={setPassword}
            value={password}
            placeholder="Password"
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            disabled={loading}
            onPress={isSignUp ? signUpWithEmail : signInWithEmail}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Log In'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setIsSignUp(!isSignUp)}
            disabled={loading}
          >
            <Text style={styles.switchText}>
              {isSignUp ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  logo: {
    fontSize: 48,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -2,
  },
  tagline: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 48,
  },
  input: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  button: {
    backgroundColor: '#0F0F0F',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  switchText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 24,
    fontSize: 14,
  },
})