// v4 Run Details. One dark ink hero moment on top (filled type badge,
// big title, pin meta, 3-col scoreboard), then light cream body with
// an InfoRow card, route map, flock avatars, waitlist, organizer, comments,
// and a sticky clay footer CTA.
//
// Preserves: all data fetches (run + participants + comments + GPX),
// all handlers (join / leave / delete / comment), deep-link to comments,
// creator edit/delete.

import { useEffect, useState, useRef } from 'react'
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Linking, Modal,
  Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View,
} from 'react-native'
import MapView, { Marker, Polyline } from 'react-native-maps'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { colors, fonts, radii, space, runTypeMeta } from '../lib/theme'
import MicroLabel from '../components/ui/MicroLabel'
import Button from '../components/ui/Button'
import CreateRunModal from './CreateRunModal'
import JoinedScreen from './JoinedScreen'

function typeKey(t) {
  if (!t) return 'easy'
  const s = String(t).toLowerCase()
  if (s.startsWith('long')) return 'long'
  if (s.startsWith('hill')) return 'hills'
  if (s.startsWith('tempo')) return 'tempo'
  if (s.startsWith('interval')) return 'intervals'
  return 'easy'
}

export default function RunDetailsScreen({ visible, onClose, runId, userId, onRunUpdated, scrollToComments }) {
  const [run, setRun] = useState(null)
  const [loading, setLoading] = useState(true)
  const [routeCoordinates, setRouteCoordinates] = useState([])
  const [loadingRoute, setLoadingRoute] = useState(false)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [joinedRun, setJoinedRun] = useState(null)
  const [joinedConfirmedCount, setJoinedConfirmedCount] = useState(0)

  const scrollViewRef = useRef(null)
  const commentsRef = useRef(null)

  useEffect(() => {
    if (visible && runId) { loadRunDetails(); loadComments() }
  }, [visible, runId])

  useEffect(() => {
    if (scrollToComments && commentsRef.current && scrollViewRef.current) {
      setTimeout(() => {
        commentsRef.current.measureLayout(
          scrollViewRef.current,
          (x, y) => scrollViewRef.current.scrollTo({ y: y - 20, animated: true }),
          () => {},
        )
      }, 500)
    }
  }, [scrollToComments, loading])

  async function loadRunDetails() {
    try {
      const { data, error } = await supabase
        .from('runs')
        .select(`
          id, creator_id, title, description, city, meeting_point,
          lat, lng, distance, pace, type, date, time, spots,
          route_url, route_gpx_url, gender_restriction, created_at,
          creator:profiles!runs_creator_id_fkey(id, full_name, avatar_url, city, bio),
          participants:run_participants(
            id, user_id, joined_at, status, waitlist_position,
            profile:profiles!run_participants_user_id_fkey(full_name, avatar_url)
          )
        `)
        .eq('id', runId).single()
      if (error) throw error
      setRun(data)
      if (data.route_gpx_url) await parseGpxFile(data.route_gpx_url)
    } catch (error) {
      console.error('Error loading run details:', error)
      Alert.alert('Error', 'Could not load run details')
    } finally { setLoading(false) }
  }

  async function loadComments() {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`id, content, created_at, user:profiles!comments_user_id_fkey(id, full_name, avatar_url)`)
        .eq('run_id', runId).order('created_at', { ascending: true })
      if (error) throw error
      setComments(data || [])
    } catch (e) { console.error('Error loading comments:', e) }
  }

  async function parseGpxFile(gpxUrl) {
    setLoadingRoute(true)
    try {
      const response = await fetch(gpxUrl)
      const gpxText = await response.text()
      let coordinates = []
      const pattern1 = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"/g
      let match
      while ((match = pattern1.exec(gpxText)) !== null) {
        const lat = parseFloat(match[1]); const lon = parseFloat(match[2])
        if (!isNaN(lat) && !isNaN(lon)) coordinates.push({ latitude: lat, longitude: lon })
      }
      if (coordinates.length === 0) {
        const pattern2 = /<trkpt\s+lon="([^"]+)"\s+lat="([^"]+)"/g
        while ((match = pattern2.exec(gpxText)) !== null) {
          const lon = parseFloat(match[1]); const lat = parseFloat(match[2])
          if (!isNaN(lat) && !isNaN(lon)) coordinates.push({ latitude: lat, longitude: lon })
        }
      }
      setRouteCoordinates(coordinates)
    } catch (e) { console.error('Error parsing GPX:', e) }
    finally { setLoadingRoute(false) }
  }

  async function handlePostComment() {
    if (!newComment.trim()) return
    setPostingComment(true)
    try {
      const { data: newCommentData, error } = await supabase
        .from('comments')
        .insert([{ run_id: runId, user_id: userId, content: newComment.trim() }])
        .select().single()
      if (error) throw error
      try {
        const { data: { session } } = await supabase.auth.getSession()
        await supabase.functions.invoke('send-comment-notification', {
          headers: { Authorization: `Bearer ${session?.access_token}` },
          body: { comment_id: newCommentData.id, run_id: runId, commenter_id: userId },
        })
      } catch (fnError) { console.error('Push notification error:', fnError) }
      setNewComment('')
      await loadComments()
    } catch (error) {
      console.error('Error posting comment:', error)
      Alert.alert('Error', 'Could not post comment')
    } finally { setPostingComment(false) }
  }

  function handleDeleteComment(commentId) {
    Alert.alert('Delete Comment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const { error } = await supabase.from('comments').delete().eq('id', commentId)
          if (error) throw error
          await loadComments()
        } catch (e) { Alert.alert('Error', 'Could not delete comment') }
      } },
    ])
  }

  async function handleJoinRun() {
    try {
      const { data, error } = await supabase.rpc('join_run', { p_run_id: runId })
      if (error) {
        if (error.code === '23505') Alert.alert('Already Joined', "You've already joined this run")
        else if (error.code === 'P0001') Alert.alert('Cannot Join', "You can't join your own run!")
        else throw error
        return
      }
      const result = Array.isArray(data) ? data[0] : data
      if (result?.status === 'waitlist') {
        Alert.alert('Added to Waitlist', `You're #${result.waitlist_position} on the waitlist. We'll notify you if a spot opens up!`)
      } else {
        const confirmedBefore = run?.participants?.filter(p => p.status === 'confirmed').length || 0
        setJoinedRun(run)
        setJoinedConfirmedCount(confirmedBefore + 1)
      }
      await loadRunDetails()
    } catch (error) {
      console.error('Error joining run:', error)
      Alert.alert('Error', 'Could not join run')
    }
  }

  function handleLeaveRun() {
    Alert.alert('Leave Run', 'Are you sure you want to leave this run?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: async () => {
        try {
          const { error } = await supabase.from('run_participants').delete()
            .eq('run_id', runId).eq('user_id', userId)
          if (error) throw error
          try {
            const { data: { session } } = await supabase.auth.getSession()
            await supabase.functions.invoke('process-waitlist', {
              headers: { Authorization: `Bearer ${session?.access_token}` },
              body: { run_id: runId },
            })
          } catch (fnError) { console.error('Error processing waitlist:', fnError) }
          if (onRunUpdated) onRunUpdated(); else await loadRunDetails()
        } catch (error) {
          console.error('Leave run error:', error)
          Alert.alert('Error', `Could not leave run: ${error?.message || error?.code || 'unknown'}`)
        }
      } },
    ])
  }

  function handleDeleteRun() {
    Alert.alert('Delete Run', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const { error } = await supabase.from('runs').delete().eq('id', runId)
          if (error) throw error
          Alert.alert('Deleted', 'Run removed.')
          onRunUpdated()
        } catch (e) { Alert.alert('Error', 'Could not delete run') }
      } },
    ])
  }

  function openRouteUrl() { if (run?.route_url) Linking.openURL(run.route_url) }

  if (loading || !run) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
        <View style={styles.loadingScreen}>
          <StatusBar barStyle="light-content" />
          <View style={styles.loadingTop}>
            <Pressable onPress={onClose} style={styles.closeBtnDark}>
              <Ionicons name="close" size={18} color={colors.cream} />
            </Pressable>
            <MicroLabel color="rgba(244,236,223,0.6)">RUN DETAILS</MicroLabel>
            <View style={{ width: 34 }} />
          </View>
          <View style={styles.loadingCenter}>
            <ActivityIndicator size="large" color={colors.clay} />
          </View>
        </View>
      </Modal>
    )
  }

  const confirmedParticipants = run.participants?.filter(p => p.status === 'confirmed') || []
  const waitlistParticipants = run.participants?.filter(p => p.status === 'waitlist') || []
  const participantCount = confirmedParticipants.length
  const waitlistCount = waitlistParticipants.length
  const isFull = participantCount >= run.spots
  const userParticipant = run.participants?.find(p => p.user_id === userId)
  const hasJoined = userParticipant?.status === 'confirmed'
  const isOnWaitlist = userParticipant?.status === 'waitlist'
  const isCreator = run.creator_id === userId
  const spotsLeft = run.spots - participantCount
  const past = isPastRun(run)

  const meta = runTypeMeta(typeKey(run.type))
  const estHours = estimateHours(run.distance, run.pace)

  const mapRegion = routeCoordinates.length > 0
    ? (() => {
        const lats = routeCoordinates.map(c => c.latitude)
        const lngs = routeCoordinates.map(c => c.longitude)
        const minLat = Math.min(...lats), maxLat = Math.max(...lats)
        const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
        return {
          latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2,
          latitudeDelta: Math.max((maxLat - minLat) * 1.3, 0.01),
          longitudeDelta: Math.max((maxLng - minLng) * 1.3, 0.01),
        }
      })()
    : run.lat && run.lng
    ? { latitude: run.lat, longitude: run.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }
    : null

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.container}>
          <ScrollView ref={scrollViewRef} style={styles.content} contentContainerStyle={{ paddingBottom: 140 }}>
            {/* Dark hero */}
            <View style={styles.hero}>
              <View style={styles.heroBar}>
                <Pressable onPress={onClose} style={styles.closeBtnDark}>
                  <Ionicons name="close" size={18} color={colors.cream} />
                </Pressable>
                <MicroLabel color="rgba(244,236,223,0.6)">RUN DETAILS</MicroLabel>
                {isCreator ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable onPress={() => setShowEditModal(true)} style={styles.closeBtnDark}>
                      <Ionicons name="create-outline" size={16} color={colors.cream} />
                    </Pressable>
                    <Pressable onPress={handleDeleteRun} style={styles.closeBtnDark}>
                      <Ionicons name="trash-outline" size={16} color={colors.cream} />
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ width: 34 }} />
                )}
              </View>

              <View style={styles.heroBody}>
                <View style={styles.heroBadgeRow}>
                  <View style={[styles.typeBadge, { backgroundColor: meta.color }]}>
                    <View style={styles.typeBadgeDot} />
                    <Text style={styles.typeBadgeText}>{meta.name}</Text>
                  </View>
                  {past ? (
                    <View style={styles.pastBadge}>
                      <Text style={styles.pastBadgeText}>PAST</Text>
                    </View>
                  ) : run.gender_restriction && run.gender_restriction !== 'all' ? (
                    <View style={styles.genderBadge}>
                      <Ionicons name="shield-checkmark" size={11} color="rgba(244,236,223,0.75)" />
                      <Text style={styles.genderBadgeText}>
                        {run.gender_restriction === 'women_only' && 'WOMEN'}
                        {run.gender_restriction === 'men_only' && 'MEN'}
                        {run.gender_restriction === 'non_binary_only' && 'NON-BINARY'}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.heroTitle}>{run.title}</Text>

                <View style={styles.heroMetaRow}>
                  <Ionicons name="location-outline" size={12} color="rgba(244,236,223,0.65)" />
                  <Text style={styles.heroMeta}>
                    {run.meeting_point?.toUpperCase()}{run.city ? ` · ${run.city.toUpperCase()}` : ''}
                  </Text>
                </View>
              </View>

              <View style={styles.heroStats}>
                <Stat label="DIST" value={fmtNumber(run.distance)} unit="mi" />
                <Stat label="PACE" value={run.pace} unit="/mi" />
                <Stat label="EST" value={estHours} unit="hr" />
              </View>
            </View>

            {/* InfoRow card */}
            <View style={styles.bodyPad}>
              <View style={styles.infoCard}>
                <InfoLine icon="calendar-outline" label="WHEN" value={`${formatDate(run.date)} · ${formatTime(run.time)}`} />
                <InfoLine icon="location-sharp" label="MEETING POINT" value={run.meeting_point} last={!run.route_url && !run.description} />
                {run.route_url ? (
                  <InfoLine icon="link-outline" label="ROUTE LINK" value={run.route_url} onPress={openRouteUrl} last={!run.description} />
                ) : null}
                {run.description ? (
                  <InfoLine icon="document-text-outline" label="NOTES" value={run.description} multi last />
                ) : null}
              </View>

              {/* Route map preview */}
              {mapRegion ? (
                <Pressable
                  style={styles.mapCard}
                  onPress={() => {
                    const lat = run.lat || mapRegion.latitude
                    const lng = run.lng || mapRegion.longitude
                    const label = encodeURIComponent(run.meeting_point || run.title)
                    const url = Platform.OS === 'ios'
                      ? `maps://0,0?q=${label}@${lat},${lng}`
                      : `geo:0,0?q=${lat},${lng}(${label})`
                    Linking.openURL(url)
                  }}
                >
                  <MapView
                    style={styles.map}
                    region={mapRegion}
                    scrollEnabled={false} zoomEnabled={false}
                    pitchEnabled={false} rotateEnabled={false}
                    pointerEvents="none"
                  >
                    {routeCoordinates.length > 0 ? (
                      <Polyline coordinates={routeCoordinates} strokeColor={meta.color} strokeWidth={4} />
                    ) : null}
                    {run.lat && run.lng ? (
                      <Marker coordinate={{ latitude: run.lat, longitude: run.lng }}>
                        <View style={[styles.pin, { backgroundColor: meta.color }]}>
                          <Ionicons name="flag" size={14} color={colors.cream} />
                        </View>
                      </Marker>
                    ) : null}
                  </MapView>
                  <View style={styles.mapPill}>
                    <Ionicons name="navigate" size={12} color={colors.cream} />
                    <Text style={styles.mapPillText}>OPEN IN MAPS</Text>
                  </View>
                  {loadingRoute ? (
                    <View style={styles.mapLoadingOverlay}>
                      <ActivityIndicator size="small" color={colors.clay} />
                    </View>
                  ) : null}
                </Pressable>
              ) : null}

              {/* The flock */}
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>THE FLOCK</Text>
                  <Text style={styles.sectionCount}>· {participantCount}/{run.spots}</Text>
                </View>
                <View style={styles.flockRow}>
                  {confirmedParticipants.map((p, i) => (
                    <FlockAvatar
                      key={p.id}
                      name={p.profile?.full_name}
                      avatarUrl={p.profile?.avatar_url}
                      color={i % 2 ? colors.ink : meta.color}
                    />
                  ))}
                  {Array.from({ length: Math.max(0, spotsLeft) }).map((_, i) => (
                    <View key={`empty-${i}`} style={styles.flockEmpty}>
                      <Ionicons name="add" size={16} color={colors.smoke} />
                    </View>
                  ))}
                </View>
              </View>

              {/* Waitlist */}
              {waitlistCount > 0 ? (
                <View style={styles.section}>
                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionTitle}>WAITLIST</Text>
                    <Text style={styles.sectionCount}>· {waitlistCount}</Text>
                  </View>
                  <View style={styles.flockRow}>
                    {waitlistParticipants
                      .sort((a, b) => a.waitlist_position - b.waitlist_position)
                      .map((p) => (
                        <View key={p.id} style={styles.waitRow}>
                          <FlockAvatar name={p.profile?.full_name} avatarUrl={p.profile?.avatar_url} color={colors.smoke} size={32} />
                          <Text style={styles.waitPos}>#{p.waitlist_position}</Text>
                        </View>
                      ))}
                  </View>
                </View>
              ) : null}

              {/* Organizer */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>ORGANIZER</Text>
                <View style={styles.creatorCard}>
                  <FlockAvatar
                    name={run.creator?.full_name}
                    avatarUrl={run.creator?.avatar_url}
                    color={colors.ink}
                    size={48}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.creatorName}>{run.creator?.full_name || 'Unknown'}</Text>
                    {run.creator?.city ? <Text style={styles.creatorSub}>{run.creator.city}</Text> : null}
                    {run.creator?.bio ? <Text style={styles.creatorBio} numberOfLines={3}>{run.creator.bio}</Text> : null}
                  </View>
                </View>
              </View>

              {/* Comments */}
              <View ref={commentsRef} onLayout={() => {}} style={styles.section}>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>COMMENTS</Text>
                  <Text style={styles.sectionCount}>· {comments.length}</Text>
                </View>
                {comments.length === 0 ? (
                  <Text style={styles.noComments}>No comments yet. Be the first.</Text>
                ) : (
                  comments.map((c) => (
                    <View key={c.id} style={styles.commentRow}>
                      <FlockAvatar name={c.user?.full_name} avatarUrl={c.user?.avatar_url} color={colors.smoke} size={32} />
                      <View style={{ flex: 1 }}>
                        <View style={styles.commentHead}>
                          <Text style={styles.commentAuthor}>{c.user?.full_name || 'Unknown'}</Text>
                          <Text style={styles.commentTime}>{formatTimestamp(c.created_at)}</Text>
                          {c.user?.id === userId ? (
                            <Pressable onPress={() => handleDeleteComment(c.id)} hitSlop={10}>
                              <Ionicons name="trash-outline" size={14} color={colors.smoke} />
                            </Pressable>
                          ) : null}
                        </View>
                        <Text style={styles.commentText}>{c.content}</Text>
                      </View>
                    </View>
                  ))
                )}

                <View style={styles.commentInputRow}>
                  <TextInput
                    value={newComment}
                    onChangeText={setNewComment}
                    placeholder="Add a comment…"
                    placeholderTextColor={colors.smoke}
                    style={styles.commentInput}
                    multiline
                    maxLength={500}
                  />
                  <Pressable
                    onPress={handlePostComment}
                    disabled={!newComment.trim() || postingComment}
                    style={[styles.sendBtn, (!newComment.trim() || postingComment) && { opacity: 0.5 }]}
                  >
                    {postingComment ? (
                      <ActivityIndicator size="small" color={colors.cream} />
                    ) : (
                      <Ionicons name="arrow-up" size={18} color={colors.cream} />
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          </ScrollView>

          {!isCreator && !past ? (
            <View style={styles.footer}>
              {hasJoined ? (
                <Button variant="outline" onPress={handleLeaveRun}>Leave Run</Button>
              ) : isOnWaitlist ? (
                <Button variant="ink" onPress={handleLeaveRun}>
                  On Waitlist · #{userParticipant?.waitlist_position}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onPress={handleJoinRun}
                  iconRight={<Ionicons name="arrow-forward" size={14} color={colors.cream} />}
                >
                  {isFull ? (waitlistCount > 0 ? `Join Waitlist · ${waitlistCount} waiting` : 'Join Waitlist') : 'Join this run'}
                </Button>
              )}
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>

      <CreateRunModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        onRunCreated={() => { setShowEditModal(false); loadRunDetails() }}
        editingRun={run}
      />
      <JoinedScreen
        visible={!!joinedRun}
        run={joinedRun}
        confirmedCount={joinedConfirmedCount}
        onClose={() => { setJoinedRun(null); onClose && onClose() }}
      />
    </Modal>
  )
}

// --- small components ----------------------------------------------------

function Stat({ label, value, unit }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <Text style={styles.statValue}>{value}</Text>
        {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
      </View>
    </View>
  )
}

function InfoLine({ icon, label, value, onPress, last, multi }) {
  const Tag = onPress ? Pressable : View
  return (
    <Tag onPress={onPress} style={[styles.infoLine, last && { borderBottomWidth: 0 }]}>
      <Ionicons name={icon} size={18} color={colors.ink} style={{ width: 22 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={multi ? 4 : 1}>{value}</Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={14} color={colors.smoke} /> : null}
    </Tag>
  )
}

function FlockAvatar({ name, avatarUrl, color = colors.ink, size = 40 }) {
  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color, alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontFamily: fonts.displayBold, fontSize: size * 0.38, color: colors.cream }}>
        {(name || '?').charAt(0).toUpperCase()}
      </Text>
    </View>
  )
}

// --- helpers -------------------------------------------------------------

function fmtNumber(n) {
  const v = Number(n); if (!isFinite(v)) return '--'
  return v >= 10 ? v.toFixed(0) : v.toFixed(1)
}

function estimateHours(distance, pace) {
  if (!distance || !pace) return '--'
  const [mm, ss] = pace.split(':').map(Number)
  const minsPerMi = (mm || 0) + (ss || 0) / 60
  const totalMins = minsPerMi * Number(distance)
  const h = Math.floor(totalMins / 60)
  const m = Math.round(totalMins % 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

function formatDate(dateString) {
  const date = new Date(dateString)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()}`
}

function formatTime(timeString) {
  const [hours, minutes] = timeString.split(':')
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${displayHour}:${minutes} ${ampm}`
}

function formatTimestamp(ts) {
  const date = new Date(ts); const now = new Date()
  const diffMins = Math.floor((now - date) / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isPastRun(run) { return new Date(`${run.date}T${run.time}`) < new Date() }

// --- styles --------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  loadingScreen: { flex: 1, backgroundColor: colors.ink },
  loadingTop: {
    paddingTop: 88, paddingHorizontal: space.md, paddingBottom: space.sm,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },

  // Hero
  hero: { backgroundColor: colors.ink, paddingTop: 88, paddingBottom: space.lg },
  heroBar: {
    paddingHorizontal: space.md, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  closeBtnDark: {
    width: 34, height: 34, borderRadius: radii.chip,
    backgroundColor: 'rgba(244,236,223,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroBody: { paddingHorizontal: space.lg, paddingTop: space.md },
  heroBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radii.chip, alignSelf: 'flex-start',
  },
  typeBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.cream },
  typeBadgeText: {
    fontFamily: fonts.displayBold, fontSize: 10,
    letterSpacing: 1.6, color: colors.cream,
  },
  pastBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radii.chip, backgroundColor: 'rgba(244,236,223,0.15)',
  },
  pastBadgeText: {
    fontFamily: fonts.displayBold, fontSize: 10,
    letterSpacing: 1.6, color: 'rgba(244,236,223,0.75)',
  },
  genderBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: radii.chip, backgroundColor: 'rgba(244,236,223,0.1)',
  },
  genderBadgeText: {
    fontFamily: fonts.displayBold, fontSize: 9,
    letterSpacing: 1.4, color: 'rgba(244,236,223,0.75)',
  },
  heroTitle: {
    fontFamily: fonts.displayBold, fontSize: 36, lineHeight: 36 * 1.1,
    letterSpacing: -1.6, color: colors.cream,
    textTransform: 'uppercase', marginTop: 14,
  },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  heroMeta: {
    fontFamily: fonts.displayBold, fontSize: 10,
    letterSpacing: 1.4, color: 'rgba(244,236,223,0.65)', flexShrink: 1,
  },
  heroStats: {
    flexDirection: 'row', marginTop: space.lg,
    paddingTop: space.md, marginHorizontal: space.lg,
    borderTopWidth: 1, borderTopColor: 'rgba(244,236,223,0.12)',
    gap: space.md,
  },
  stat: { flex: 1 },
  statLabel: {
    fontFamily: fonts.displayBold, fontSize: 9,
    letterSpacing: 1.4, color: 'rgba(244,236,223,0.5)', marginBottom: 6,
  },
  statValue: {
    fontFamily: fonts.displayBold, fontSize: 28,
    letterSpacing: -1, color: colors.cream, lineHeight: 30,
  },
  statUnit: {
    fontFamily: fonts.displayBold, fontSize: 11,
    letterSpacing: 0.4, color: 'rgba(244,236,223,0.55)',
  },

  // Body
  bodyPad: { paddingHorizontal: space.md, paddingTop: space.lg },
  infoCard: {
    backgroundColor: colors.paper, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.line, marginBottom: space.lg,
    overflow: 'hidden',
  },
  infoLine: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  infoLabel: {
    fontFamily: fonts.displayBold, fontSize: 9,
    letterSpacing: 1.4, color: colors.smoke,
  },
  infoValue: {
    fontFamily: fonts.bodySemibold, fontSize: 13,
    color: colors.ink, marginTop: 2,
  },

  // Map card
  mapCard: {
    height: 200, borderRadius: radii.card, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.line, marginBottom: space.lg,
    position: 'relative',
  },
  map: { flex: 1 },
  pin: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.cream,
  },
  mapPill: {
    position: 'absolute', bottom: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: colors.ink, borderRadius: radii.chip,
  },
  mapPillText: {
    fontFamily: fonts.displayBold, fontSize: 10,
    letterSpacing: 1.4, color: colors.cream,
  },
  mapLoadingOverlay: {
    position: 'absolute', inset: 0,
    backgroundColor: 'rgba(244,236,223,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Sections
  section: { marginBottom: space.lg },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: space.sm },
  sectionTitle: {
    fontFamily: fonts.displayBold, fontSize: 18,
    letterSpacing: -0.4, color: colors.ink, textTransform: 'uppercase',
  },
  sectionCount: {
    fontFamily: fonts.displayBold, fontSize: 11,
    letterSpacing: 1.4, color: colors.smoke,
  },

  // Flock
  flockRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  flockEmpty: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: colors.lineStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  waitRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 10 },
  waitPos: {
    fontFamily: fonts.displayBold, fontSize: 11,
    letterSpacing: 1.4, color: colors.smoke,
  },

  // Creator
  creatorCard: {
    flexDirection: 'row', gap: 12,
    backgroundColor: colors.paper, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.line, padding: 14,
  },
  creatorName: {
    fontFamily: fonts.displayBold, fontSize: 15,
    color: colors.ink, letterSpacing: -0.2,
  },
  creatorSub: {
    fontFamily: fonts.body, fontSize: 12,
    color: colors.smoke, marginTop: 2,
  },
  creatorBio: {
    fontFamily: fonts.body, fontSize: 13,
    color: colors.ink2, lineHeight: 19, marginTop: 6,
  },

  // Comments
  noComments: {
    fontFamily: fonts.body, fontSize: 13,
    color: colors.smoke, textAlign: 'center', paddingVertical: 14,
  },
  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  commentHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  commentAuthor: {
    fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.ink,
  },
  commentTime: {
    fontFamily: fonts.body, fontSize: 11, color: colors.smoke, flex: 1,
  },
  commentText: {
    fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink2,
  },
  commentInputRow: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-end',
    paddingTop: space.sm, marginTop: space.sm,
    borderTopWidth: 1, borderTopColor: colors.line,
  },
  commentInput: {
    flex: 1, minHeight: 40, maxHeight: 100,
    backgroundColor: colors.paper, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: fonts.body, fontSize: 14, color: colors.ink,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.clay,
    alignItems: 'center', justifyContent: 'center',
  },

  // Footer CTA
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: 28,
    backgroundColor: colors.cream,
    borderTopWidth: 1, borderTopColor: colors.line,
  },
})
