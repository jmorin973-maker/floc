// @deno-types="npm:@supabase/supabase-js@2"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

interface RunsByCity {
  [key: string]: number
}

interface PushMessage {
  to: string
  sound: string
  title: string
  body: string
  data: {
    city: string
    count: number
  }
}

Deno.serve(async (req: Request) => {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    
    const { data: recentRuns, error: runsError } = await supabaseAdmin
      .from('runs')
      .select('city')
      .gte('created_at', yesterday.toISOString())

    if (runsError) throw runsError

    const runsByCity: RunsByCity = {}
    recentRuns?.forEach((run: any) => {
      if (run.city) {
        runsByCity[run.city] = (runsByCity[run.city] || 0) + 1
      }
    })

    const { data: users, error: usersError } = await supabaseAdmin
      .from('profiles')
      .select('id, city, push_token, last_notified_at')
      .eq('notifications_enabled', true)
      .not('push_token', 'is', null)

    if (usersError) throw usersError

    const messages: PushMessage[] = []
    const userIdsToUpdate: string[] = []

    for (const user of users || []) {
      if (user.last_notified_at) {
        const lastNotified = new Date(user.last_notified_at)
        const now = new Date()
        const hoursSinceLastNotification = (now.getTime() - lastNotified.getTime()) / (1000 * 60 * 60)
        if (hoursSinceLastNotification < 20) {
          continue
        }
      }

      const runsInUserCity = runsByCity[user.city] || 0
      
      if (runsInUserCity > 0 && user.push_token) {
        messages.push({
          to: user.push_token,
          sound: 'default',
          title: '🏃 New Runs in Your Area',
          body: `${runsInUserCity} new run${runsInUserCity > 1 ? 's' : ''} posted in ${user.city} today!`,
          data: { city: user.city, count: runsInUserCity },
        })
        userIdsToUpdate.push(user.id)
      }
    }

    if (messages.length > 0) {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      })

      const result = await response.json()
      
      if (userIdsToUpdate.length > 0) {
        await supabaseAdmin
          .from('profiles')
          .update({ last_notified_at: new Date().toISOString() })
          .in('id', userIdsToUpdate)
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          sentCount: messages.length,
          result 
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, sentCount: 0, message: 'No notifications to send' }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})