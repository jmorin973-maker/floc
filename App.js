import * as SplashScreen from 'expo-splash-screen'
import SplashAnimationScreen from './screens/SplashAnimationScreen'
import { useEffect, useState, useRef } from 'react'
import { View, StyleSheet, Alert, Platform } from 'react-native'
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import * as Notifications from 'expo-notifications'
import { supabase } from './lib/supabase'
import { registerForPushNotificationsAsync, savePushToken } from './lib/notifications'
import AuthScreen from './screens/AuthScreen'
import DiscoverScreen from './screens/DiscoverScreen'
import MyRunsScreen from './screens/MyRunsScreen'
import CreateRunModal from './screens/CreateRunModal'
import ProfileScreen from './screens/ProfileScreen'
import AsyncStorage from '@react-native-async-storage/async-storage'
import OnboardingScreen from './screens/OnboardingScreen'
import { useFonts, SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk'
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter'

const navigationRef = createNavigationContainerRef()
const Tab = createBottomTabNavigator()

export default function App() {
  const [session, setSession] = useState(null)
  const [userId, setUserId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [userProfile, setUserProfile] = useState(null)
  const [notificationRunId, setNotificationRunId] = useState(null)
  const [shouldOpenFromNotification, setShouldOpenFromNotification] = useState(false)
  const [showSplash, setShowSplash] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)

  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  })

  const notificationListener = useRef()
  const responseListener = useRef()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      setShowProfile(false)
      if (session) {
        setUserId(session.user.id)
        loadUserProfile(session.user.id)
        const hasOnboarded = await AsyncStorage.getItem('floc_onboarded')
        if (!hasOnboarded) {
          setShowOnboarding(true)
        }
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setShowProfile(false)
      if (session) {
        setUserId(session.user.id)
        loadUserProfile(session.user.id)
        const hasOnboarded = await AsyncStorage.getItem('floc_onboarded')
        if (!hasOnboarded) {
          setShowOnboarding(true)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) {
      notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
        console.log('Notification received:', notification)
      })

      responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('Notification tapped:', response)

        const runId = response.notification.request.content.data?.run_id

        if (runId) {
          setNotificationRunId(runId)
          setShouldOpenFromNotification(true)
        }
      })

      return () => {
        if (notificationListener.current) {
          notificationListener.current.remove()
        }
        if (responseListener.current) {
          responseListener.current.remove()
        }
      }
    }
  }, [session])

  useEffect(() => {
    SplashScreen.hideAsync()
  }, [])

  async function loadUserProfile(id) {
    const userIdToUse = id || userId

    if (!userIdToUse) {
      console.log('No userId available yet')
      return
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, city, bio, gender, notifications_enabled, last_notified_at')
        .eq('id', userIdToUse)
        .maybeSingle()

      if (error) throw error
      setUserProfile(data)
    } catch (error) {
      console.error('Error loading user profile:', error)
    }
  }

  async function handleLogout() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setSession(null)
      setUserId(null)
      setUserProfile(null)
    } catch (error) {
      console.error('Error logging out:', error)
      Alert.alert('Error', 'Could not log out')
    }
  }

  function handleCloseProfile() {
    setShowProfile(false)
    setTimeout(() => {
      if (session) {
        loadUserProfile(session.user.id)
        setRefreshTrigger(prev => prev + 1)
      }
    }, 300)
  }

  async function handleOnboardingComplete() {
    await AsyncStorage.setItem('floc_onboarded', 'true')
    setShowOnboarding(false)
    if (session) loadUserProfile(session.user.id)
    setTimeout(() => {
      if (navigationRef.isReady()) {
        navigationRef.navigate('Discover')
      }
    }, 100)
  }

  if (showSplash || !fontsLoaded) {
    return <SplashAnimationScreen onFinished={() => setShowSplash(false)} />
  }

  if (loading) {
    return <View style={styles.container} />
  }

  if (!session) {
    return <AuthScreen />
  }

  if (showOnboarding) {
    return (
      <OnboardingScreen
        onComplete={handleOnboardingComplete}
        userId={userId}
      />
    )
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => {
            if (route.name === 'Discover') {
              return <Ionicons name={focused ? 'compass' : 'compass-outline'} size={size} color={color} />
            } else if (route.name === 'MyRuns') {
              return <Ionicons name={focused ? 'list' : 'list-outline'} size={size} color={color} />
            }
            return null
          },
          tabBarActiveTintColor: '#C4562A',
          tabBarInactiveTintColor: '#999',
          tabBarStyle: {
            height: 90,
            paddingBottom: 30,
            paddingTop: 10,
          },
        })}
      >
        <Tab.Screen
          name="Discover"
          options={{ title: 'Discover' }}
        >
          {() => (
            <DiscoverScreen
              onProfilePress={() => setShowProfile(true)}
              refreshTrigger={refreshTrigger}
              userProfile={userProfile}
              notificationRunId={notificationRunId}
              shouldOpenFromNotification={shouldOpenFromNotification}
              onNotificationHandled={() => {
                setNotificationRunId(null)
                setShouldOpenFromNotification(false)
              }}
            />
          )}
        </Tab.Screen>

        <Tab.Screen
          name="Create"
          component={View}
          options={{
            title: '',
            tabBarIcon: () => (
              <View style={{
                marginTop: -20,
                width: 70,
                height: 70,
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <Ionicons name="add-circle" size={70} color="#1A0F0A" />
              </View>
            )
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault()
              setShowCreateModal(true)
            },
          }}
        />

        <Tab.Screen
          name="MyRuns"
          options={{ title: 'My Runs' }}
        >
          {() => (
            <MyRunsScreen
              onProfilePress={() => setShowProfile(true)}
              userProfile={userProfile}
            />
          )}
        </Tab.Screen>
      </Tab.Navigator>

      <CreateRunModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        userGender={userProfile?.gender}
        onRunCreated={() => {
          setShowCreateModal(false)
          setRefreshTrigger(prev => prev + 1)
        }}
      />

      <ProfileScreen
        visible={showProfile}
        onClose={handleCloseProfile}
        onLogout={handleLogout}
        userProfile={userProfile}
        onProfileUpdate={loadUserProfile}
        userId={userId}
      />
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0EA',
  },
})