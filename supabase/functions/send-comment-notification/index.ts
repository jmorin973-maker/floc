import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
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
    // Use service role key to bypass RLS
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { comment_id, run_id, commenter_id } = await req.json()

    // Basic validation
    if (!comment_id || !run_id || !commenter_id) {
      throw new Error('Missing required fields')
    }

    // Get comment details
    const { data: comment, error: commentError } = await supabaseClient
      .from('comments')
      .select('content')
      .eq('id', comment_id)
      .single()

    if (commentError) {
      console.error('Comment error:', commentError)
      throw commentError
    }

    // Get commenter details
    const { data: commenter, error: commenterError } = await supabaseClient
      .from('profiles')
      .select('full_name')
      .eq('id', commenter_id)
      .single()

    if (commenterError) {
      console.error('Commenter error:', commenterError)
      throw commenterError
    }

    // Get run details and creator
    const { data: run, error: runError } = await supabaseClient
      .from('runs')
      .select('title, creator_id')
      .eq('id', run_id)
      .single()

    if (runError) {
      console.error('Run error:', runError)
      throw runError
    }

    // Get all users to notify (run creator + other commenters, excluding the new commenter)
    const usersToNotify = new Set<string>()
    
    // Add run creator if not the commenter
    if (run.creator_id !== commenter_id) {
      usersToNotify.add(run.creator_id)
    }

    // Get all other commenters
    const { data: otherCommenters, error: commentersError } = await supabaseClient
      .from('comments')
      .select('user_id')
      .eq('run_id', run_id)
      .neq('user_id', commenter_id)
      .neq('user_id', run.creator_id)

    if (!commentersError && otherCommenters) {
      otherCommenters.forEach(c => usersToNotify.add(c.user_id))
    }

    console.log('Users to notify:', Array.from(usersToNotify))

    // Get push tokens for all users to notify
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('id, push_token, notifications_enabled')
      .in('id', Array.from(usersToNotify))
      .eq('notifications_enabled', true)
      .not('push_token', 'is', null)

    if (profilesError) {
      console.error('Profiles error:', profilesError)
      throw profilesError
    }

    console.log('Found profiles with push tokens:', profiles?.length || 0)

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No users to notify', success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send push notifications
    const messages = profiles.map(profile => ({
      to: profile.push_token,
      sound: 'default',
      title: `💬 ${commenter.full_name}`,
      body: profile.id === run.creator_id 
        ? `Commented on your run "${run.title}"`
        : `Also commented on "${run.title}"`,
      data: { 
        type: 'comment',
        run_id: run_id,
        comment_id: comment_id
      },
    }))

    console.log('Sending push notifications to:', messages.length, 'users')

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    })

    const result = await response.json()
    console.log('Expo push result:', result)

    return new Response(
      JSON.stringify({ 
        success: true, 
        notified: profiles.length,
        result 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})