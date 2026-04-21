import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import 'react-native-url-polyfill/auto'

const supabaseUrl = 'https://owzmstwxsrkvdptzgmws.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93em1zdHd4c3JrdmRwdHpnbXdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MzU3ODcsImV4cCI6MjA4NzAxMTc4N30.I7JOyMGKJsyoSiaEJvhb3r3bBN1JnpOfOBJS3c2XdtA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})