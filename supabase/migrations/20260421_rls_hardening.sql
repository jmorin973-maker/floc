-- 1) Drop the overly-permissive INSERT policy on notifications.
-- The app never inserts notifications client-side; edge functions use the
-- service_role key which bypasses RLS. Keeping this policy lets any
-- authenticated user forge notifications into other users' feeds.
drop policy if exists "System can create notifications" on public.notifications;

-- 2) Hide profiles.push_token from client roles. Only service_role (used by
-- edge functions for sending push) needs to read it. Without this, anyone
-- logged in could harvest every user's Expo push token.
revoke select (push_token) on public.profiles from authenticated, anon;
