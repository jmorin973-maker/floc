import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    // Get run details to check spots
    const { data: run, error: runError } = await supabaseClient
      .from('runs')
      .select('spots, title')
      .eq('id', run_id)
      .single()

    if (runError) throw runError

    // Count confirmed participants
    const { count: confirmedCount, error: countError } = await supabaseClient
      .from('run_participants')
      .select('*', { count: 'exact', head: true })
      .eq('run_id', run_id)
      .eq('status', 'confirmed')

    if (countError) throw countError

    // Check if there's room and if there's a waitlist
    if (confirmedCount < run.spots) {
      // Get first person on waitlist
      const { data: waitlistPerson, error: waitlistError } = await supabaseClient
        .from('run_participants')
        .select('*, profile:profiles!run_participants_user_id_fkey(full_name, push_token)')
        .eq('run_id', run_id)
        .eq('status', 'waitlist')
        .order('waitlist_position', { ascending: true })
        .limit(1)
        .single()

      if (waitlistError && waitlistError.code !== 'PGRST116') throw waitlistError

      if (waitlistPerson) {
        // Promote to confirmed
        const { error: updateError } = await supabaseClient
          .from('run_participants')
          .update({ 
            status: 'confirmed',
            waitlist_position: null 
          })
          .eq('id', waitlistPerson.id)

        if (updateError) throw updateError

        // Update remaining waitlist positions (decrement by 1)
        const { data: remainingWaitlist } = await supabaseClient
          .from('run_participants')
          .select('id, waitlist_position')
          .eq('run_id', run_id)
          .eq('status', 'waitlist')
          .order('waitlist_position', { ascending: true })

        if (remainingWaitlist) {
          for (let i = 0; i < remainingWaitlist.length; i++) {
            await supabaseClient
              .from('run_participants')
              .update({ waitlist_position: i + 1 })
              .eq('id', remainingWaitlist[i].id)
          }
        }

        // Send push notification to promoted person
        if (waitlistPerson.profile?.push_token) {
          const pushMessage = {
            to: waitlistPerson.profile.push_token,
            sound: 'default',
            title: 'You\'re In! 🎉',
            body: `A spot opened up for "${run.title}". You've been moved from the waitlist!`,
            data: { run_id: run_id },
          }

          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(pushMessage),
          })
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            promoted: true,
            promoted_user: waitlistPerson.profile?.full_name 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({ success: true, promoted: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})