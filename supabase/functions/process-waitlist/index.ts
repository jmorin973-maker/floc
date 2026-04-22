// Notify-only waitlist handler.
//
// The DB trigger run_participants_promote_waitlist atomically promotes
// the next waitlist entry when a confirmed participant leaves. This
// function's only job is to find the just-promoted participant and
// send them a push notification.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Only consider participants promoted within this window. Long enough
// to absorb client/network delay, short enough that replays of this
// endpoint can't re-notify an older promotion.
const PROMOTION_LOOKBACK_SECONDS = 60

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { run_id } = await req.json()
    if (!run_id) {
      return new Response(
        JSON.stringify({ error: 'run_id required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const since = new Date(Date.now() - PROMOTION_LOOKBACK_SECONDS * 1000).toISOString()

    const { data: promoted, error: promotedError } = await supabaseClient
      .from('run_participants')
      .select('user_id, promoted_at, profile:profiles!run_participants_user_id_fkey(full_name, push_token)')
      .eq('run_id', run_id)
      .eq('status', 'confirmed')
      .gte('promoted_at', since)
      .order('promoted_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (promotedError) throw promotedError

    if (!promoted) {
      return new Response(
        JSON.stringify({ success: true, notified: false, reason: 'no_recent_promotion' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const pushToken = promoted.profile?.push_token
    if (!pushToken) {
      return new Response(
        JSON.stringify({ success: true, notified: false, reason: 'no_push_token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: run, error: runError } = await supabaseClient
      .from('runs')
      .select('title')
      .eq('id', run_id)
      .maybeSingle()
    if (runError) throw runError

    const pushMessage = {
      to: pushToken,
      sound: 'default',
      title: "You're In! 🎉",
      body: `A spot opened up for "${run?.title ?? 'a run'}". You've been moved from the waitlist!`,
      data: { run_id },
    }

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pushMessage),
    })

    return new Response(
      JSON.stringify({ success: true, notified: true, user: promoted.profile?.full_name }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
