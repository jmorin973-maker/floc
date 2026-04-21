import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { supabase } from './supabase'

// Configure how notifications are handled when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export async function registerForPushNotificationsAsync() {
  let token

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0F0F0F',
    })
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!')
      return null
    }
    
    token = (await Notifications.getExpoPushTokenAsync({
      projectId: '4b96740d-fc1c-4c5a-916c-7fdd243b5bbb'
    })).data
  } else {
    console.log('Must use physical device for Push Notifications')
  }

  return token
}

export async function savePushToken(userId, token) {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ 
        push_token: token,
        notifications_enabled: true
      })
      .eq('id', userId)

    if (error) throw error
    console.log('Push token saved successfully')
  } catch (error) {
    console.error('Error saving push token:', error)
  }
}

export async function updateNotificationSettings(userId, enabled) {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ notifications_enabled: enabled })
      .eq('id', userId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error updating notification settings:', error)
    return false
  }
}