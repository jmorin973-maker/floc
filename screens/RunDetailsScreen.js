import { useEffect, useState, useRef } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import MapView, { Marker, Polyline, PROVIDER_APPLE } from 'react-native-maps'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import CreateRunModal from './CreateRunModal'

export default function RunDetailsScreen({ visible, onClose, runId, userId, onRunUpdated, scrollToComments }) {
  const [run, setRun] = useState(null)
  const [loading, setLoading] = useState(true)
  const [routeCoordinates, setRouteCoordinates] = useState([])
  const [loadingRoute, setLoadingRoute] = useState(false)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  
  const scrollViewRef = useRef(null)
  const commentsRef = useRef(null)
  const [showEditModal, setShowEditModal] = useState(false)

  useEffect(() => {
    if (visible && runId) {
      loadRunDetails()
      loadComments()
    }
  }, [visible, runId])

  useEffect(() => {
    if (scrollToComments && commentsRef.current && scrollViewRef.current) {
      setTimeout(() => {
        commentsRef.current.measureLayout(
          scrollViewRef.current,
          (x, y) => {
            scrollViewRef.current.scrollTo({ y: y - 20, animated: true })
          },
          () => {}
        )
      }, 500)
    }
  }, [scrollToComments, loading])

  async function loadRunDetails() {
    try {
      const { data, error } = await supabase
        .from('runs')
        .select(`
          id,
          creator_id,
          title,
          description,
          city,
          meeting_point,
          lat,
          lng,
          distance,
          pace,
          type,
          date,
          time,
          spots,
          route_url,
          route_gpx_url,
          gender_restriction,
          created_at,
          creator:profiles!runs_creator_id_fkey(id, full_name, avatar_url, city, bio),
          participants:run_participants(
            id,
            user_id,
            joined_at,
            status,
            waitlist_position,
            profile:profiles!run_participants_user_id_fkey(full_name, avatar_url)
          )
        `)
        .eq('id', runId)
        .single()

      if (error) throw error
      setRun(data)

      // Parse GPX if available
      if (data.route_gpx_url) {
        await parseGpxFile(data.route_gpx_url)
      }
    } catch (error) {
      console.error('Error loading run details:', error)
      Alert.alert('Error', 'Could not load run details')
    } finally {
      setLoading(false)
    }
  }

  async function loadComments() {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          id,
          content,
          created_at,
          user:profiles!comments_user_id_fkey(id, full_name, avatar_url)
        `)
        .eq('run_id', runId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setComments(data || [])
    } catch (error) {
      console.error('Error loading comments:', error)
    }
  }

  async function parseGpxFile(gpxUrl) {
    setLoadingRoute(true)
    try {
      console.log('Fetching GPX from:', gpxUrl)
      const response = await fetch(gpxUrl)
      const gpxText = await response.text()
      
      console.log('GPX text length:', gpxText.length)

      // Try multiple regex patterns for different GPX formats
      let coordinates = []
      
      // Pattern 1: lat="..." lon="..."
      const pattern1 = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"/g
      let match
      while ((match = pattern1.exec(gpxText)) !== null) {
        const lat = parseFloat(match[1])
        const lon = parseFloat(match[2])
        
        if (!isNaN(lat) && !isNaN(lon)) {
          coordinates.push({
            latitude: lat,
            longitude: lon,
          })
        }
      }
      
      // Pattern 2: lon="..." lat="..." (reversed order)
      if (coordinates.length === 0) {
        const pattern2 = /<trkpt\s+lon="([^"]+)"\s+lat="([^"]+)"/g
        while ((match = pattern2.exec(gpxText)) !== null) {
          const lon = parseFloat(match[1])
          const lat = parseFloat(match[2])
          
          if (!isNaN(lat) && !isNaN(lon)) {
            coordinates.push({
              latitude: lat,
              longitude: lon,
            })
          }
        }
      }

      console.log(`Parsed ${coordinates.length} coordinates from GPX`)
      setRouteCoordinates(coordinates)
    } catch (error) {
      console.error('Error parsing GPX:', error)
    } finally {
      setLoadingRoute(false)
    }
  }

  async function handlePostComment() {
    if (!newComment.trim()) return

    setPostingComment(true)
    try {
      const { data: newCommentData, error } = await supabase
        .from('comments')
        .insert([{
          run_id: runId,
          user_id: userId,
          content: newComment.trim()
        }])
        .select()
        .single()

      if (error) throw error

      console.log('Comment posted, sending push notifications...')
      
      // Call Edge Function to send push notifications
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        const { data, error: fnError } = await supabase.functions.invoke('send-comment-notification', {
          headers: {
            Authorization: `Bearer ${session?.access_token}`
          },
          body: {
            comment_id: newCommentData.id,
            run_id: runId,
            commenter_id: userId
          }
        })
        
        console.log('Push notification response:', JSON.stringify(data, null, 2))
        if (fnError) {
          console.error('Push notification error details:', JSON.stringify(fnError, null, 2))
        }
      } catch (fnError) {
        console.error('Error sending push notifications:', JSON.stringify(fnError, null, 2))
      }

      setNewComment('')
      await loadComments()
    } catch (error) {
      console.error('Error posting comment:', error)
      Alert.alert('Error', 'Could not post comment')
    } finally {
      setPostingComment(false)
    }
  }

  async function handleDeleteComment(commentId) {
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('comments')
                .delete()
                .eq('id', commentId)

              if (error) throw error
              await loadComments()
            } catch (error) {
              Alert.alert('Error', 'Could not delete comment')
            }
          },
        },
      ]
    )
  }

  async function handleJoinRun() {
    try {
      const { data, error } = await supabase.rpc('join_run', { p_run_id: runId })

      if (error) {
        if (error.code === '23505') {
          Alert.alert('Already Joined', "You've already joined this run")
        } else if (error.code === 'P0001') {
          Alert.alert('Cannot Join', "You can't join your own run!")
        } else {
          throw error
        }
        return
      }

      const result = Array.isArray(data) ? data[0] : data
      if (result?.status === 'waitlist') {
        Alert.alert(
          'Added to Waitlist',
          `You're #${result.waitlist_position} on the waitlist. We'll notify you if a spot opens up!`
        )
      }

      await loadRunDetails()
    } catch (error) {
      console.error('Error joining run:', error)
      Alert.alert('Error', 'Could not join run')
    }
  }

  async function handleLeaveRun() {
    Alert.alert(
      'Leave Run',
      'Are you sure you want to leave this run?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('run_participants')
                .delete()
                .eq('run_id', runId)
                .eq('user_id', userId)

              if (error) throw error
              
              // Process waitlist to promote next person
              try {
                const { data: { session } } = await supabase.auth.getSession()
                
                await supabase.functions.invoke('process-waitlist', {
                  headers: {
                    Authorization: `Bearer ${session?.access_token}`
                  },
                  body: {
                    run_id: runId
                  }
                })
              } catch (fnError) {
                console.error('Error processing waitlist:', fnError)
              }
              
              if (onRunUpdated) {
                onRunUpdated()
              } else {
                await loadRunDetails()
              }
            } catch (error) {
              console.error('Leave run error:', error)
              Alert.alert(
                'Error',
                `Could not leave run: ${error?.message || error?.code || 'unknown'}`
              )
            }
          },
        },
      ]
    )
  }

  async function handleDeleteRun() {
    Alert.alert(
      'Delete Run',
      'Are you sure? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('runs')
                .delete()
                .eq('id', runId)

              if (error) throw error
              
              Alert.alert('Success', 'Run deleted')
              onRunUpdated()
            } catch (error) {
              Alert.alert('Error', 'Could not delete run')
            }
          },
        },
      ]
    )
  }

  function openRouteUrl() {
    if (run?.route_url) {
      Linking.openURL(run.route_url)
    }
  }

  function formatTimestamp(timestamp) {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (loading || !run) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color="#666" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Run Details</Text>
            <View style={{ width: 28 }} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#C4562A" />
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

  console.log('RunDetailsScreen counts:', { 
    total: run.participants?.length,
    confirmed: participantCount, 
    waitlist: waitlistCount,
    isFull,
    spots: run.spots 
  })

  // Calculate map region to fit the route
  const mapRegion = routeCoordinates.length > 0
    ? (() => {
        // Find bounds of the route
        const lats = routeCoordinates.map(c => c.latitude)
        const lngs = routeCoordinates.map(c => c.longitude)
        const minLat = Math.min(...lats)
        const maxLat = Math.max(...lats)
        const minLng = Math.min(...lngs)
        const maxLng = Math.max(...lngs)
        
        // Calculate center and deltas with padding
        const centerLat = (minLat + maxLat) / 2
        const centerLng = (minLng + maxLng) / 2
        const latDelta = (maxLat - minLat) * 1.3 // 30% padding
        const lngDelta = (maxLng - minLng) * 1.3
        
        return {
          latitude: centerLat,
          longitude: centerLng,
          latitudeDelta: Math.max(latDelta, 0.01), // Minimum zoom level
          longitudeDelta: Math.max(lngDelta, 0.01),
        }
      })()
    : run.lat && run.lng
    ? {
        latitude: run.lat,
        longitude: run.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : null

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color="#666" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Run Details</Text>
            {isCreator ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <TouchableOpacity onPress={() => setShowEditModal(true)}>
                  <Ionicons name="create-outline" size={24} color="#666" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDeleteRun}>
                  <Ionicons name="trash" size={24} color="#DC2626" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ width: 28 }} />
            )}
          </View>

          <ScrollView 
            style={styles.content}
            ref={scrollViewRef}
          >
            <View style={[styles.colorBar, { backgroundColor: getTypeColor(run.type) }]} />

            <View style={styles.section}>
              <View style={styles.cardHeader}>
                <View style={styles.badgeRow}>
                  <View style={[styles.typeBadge, { backgroundColor: getTypeBadgeColor(run.type) }]}>
                    <Text style={[styles.typeText, { color: getTypeColor(run.type) }]}>
                      {run.type.toUpperCase()}
                    </Text>
                  </View>
                  {isPastRun(run) ? (
                    <View style={styles.pastBadge}>
                      <Text style={styles.pastBadgeText}>PAST</Text>
                    </View>
                  ) : run.gender_restriction && run.gender_restriction !== 'all' && (
                    <View style={styles.genderBadge}>
                      <Ionicons name="shield-checkmark" size={14} color="#666" />
                      <Text style={styles.genderBadgeText}>
                        {run.gender_restriction === 'women_only' && 'Women only'}
                        {run.gender_restriction === 'men_only' && 'Men only'}
                        {run.gender_restriction === 'non_binary_only' && 'Non-binary only'}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.locationBadge}>
                  <Ionicons name="location-sharp" size={14} color="#AAA" />
                  <Text style={styles.locationText}>{run.city}</Text>
                </View>
              </View>

              <Text style={styles.title}>{run.title}</Text>

              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>DISTANCE</Text>
                  <Text style={styles.statValue}>
                    {run.distance} <Text style={styles.statUnit}>mi</Text>
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>PACE</Text>
                  <Text style={styles.statValue}>
                    {run.pace} <Text style={styles.statUnit}>/ mi</Text>
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="calendar" size={18} color="#999" />
                <Text style={styles.detailText}>
                  {formatDate(run.date)} · {formatTime(run.time)}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="location-sharp" size={18} color="#999" />
                <Text style={styles.detailText}>{run.meeting_point}</Text>
              </View>

              {run.description && (
                <Text style={styles.description}>{run.description}</Text>
              )}

              <View style={styles.progressSection}>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${(participantCount / run.spots) * 100}%` }
                    ]} 
                  />
                </View>
                <View style={styles.spotsRow}>
                  <Text style={styles.runnersJoined}>{participantCount} runners joined</Text>
                  <Text style={styles.spotsLeft}>
                    {isFull && waitlistCount > 0 
                      ? `${waitlistCount} on waitlist`
                      : `${spotsLeft} spots left`
                    }
                  </Text>
                </View>
              </View>
            </View>

            {(run.route_url || routeCoordinates.length > 0 || (run.lat && run.lng)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {routeCoordinates.length > 0 ? 'Route' : 'Location'}
                </Text>
                
                {mapRegion && (
                  <TouchableOpacity 
                    style={styles.mapContainer}
                    onPress={() => {
                      // Always open the meeting point
                      const lat = run.lat || mapRegion.latitude
                      const lng = run.lng || mapRegion.longitude
                      const label = encodeURIComponent(run.meeting_point || run.title)
                      const url = Platform.OS === 'ios'
                        ? `maps://0,0?q=${label}@${lat},${lng}`
                        : `geo:0,0?q=${lat},${lng}(${label})`
                      Linking.openURL(url)
                    }}
                    activeOpacity={0.8}
                  >
                    <MapView
                      provider={PROVIDER_APPLE}
                      style={styles.map}
                      region={mapRegion}
                      scrollEnabled={false}
                      zoomEnabled={false}
                      pitchEnabled={false}
                      rotateEnabled={false}
                      pointerEvents="none"
                    >
                      {routeCoordinates.length > 0 && (
                        <Polyline
                          coordinates={routeCoordinates}
                          strokeColor={getTypeColor(run.type)}
                          strokeWidth={4}
                        />
                      )}
                      {run.lat && run.lng && (
                        <Marker
                          coordinate={{
                            latitude: run.lat,
                            longitude: run.lng,
                          }}
                        >
                          <View style={[styles.marker, { backgroundColor: getTypeColor(run.type) }]}>
                            <Ionicons name="flag" size={16} color="white" />
                          </View>
                        </Marker>
                      )}
                    </MapView>
                    <View style={styles.mapOverlay}>
                      <View style={styles.mapBadge}>
                        <Ionicons name="navigate" size={16} color="white" />
                        <Text style={styles.mapBadgeText}>Open in Maps</Text>
                      </View>
                    </View>
                    {loadingRoute && (
                      <View style={styles.mapLoading}>
                        <ActivityIndicator size="small" color="#666" />
                      </View>
                    )}
                  </TouchableOpacity>
                )}

                {run.route_url && (
                  <TouchableOpacity style={styles.routeUrlButton} onPress={openRouteUrl}>
                    <Ionicons name="link" size={20} color="#0F0F0F" />
                    <Text style={styles.routeUrlText} numberOfLines={1}>
                      {run.route_url}
                    </Text>
                    <Ionicons name="open-outline" size={20} color="#666" />
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Organizer</Text>
              <View style={styles.creatorCard}>
                {run.creator?.avatar_url ? (
                  <Image 
                    source={{ uri: run.creator.avatar_url }} 
                    style={styles.creatorAvatar}
                  />
                ) : (
                  <View style={styles.creatorAvatarPlaceholder}>
                    <Text style={styles.creatorAvatarText}>
                      {run.creator?.full_name?.charAt(0) || '?'}
                    </Text>
                  </View>
                )}
                <View style={styles.creatorInfo}>
                  <Text style={styles.creatorName}>{run.creator?.full_name || 'Unknown'}</Text>
                  {run.creator?.city && (
                    <Text style={styles.creatorCity}>{run.creator.city}</Text>
                  )}
                  {run.creator?.bio && (
                    <Text style={styles.creatorBio}>{run.creator.bio}</Text>
                  )}
                </View>
              </View>
            </View>

            {participantCount > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Participants ({participantCount})
                </Text>
                {confirmedParticipants.map((participant) => (
                  <View key={participant.id} style={styles.participantRow}>
                    {participant.profile?.avatar_url ? (
                      <Image 
                        source={{ uri: participant.profile.avatar_url }} 
                        style={styles.participantAvatar}
                      />
                    ) : (
                      <View style={styles.participantAvatarPlaceholder}>
                        <Text style={styles.participantAvatarText}>
                          {participant.profile?.full_name?.charAt(0) || '?'}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.participantName}>
                      {participant.profile?.full_name || 'Unknown'}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {waitlistCount > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Waitlist ({waitlistCount})
                </Text>
                {waitlistParticipants
                  .sort((a, b) => a.waitlist_position - b.waitlist_position)
                  .map((participant) => (
                    <View key={participant.id} style={styles.participantRow}>
                      {participant.profile?.avatar_url ? (
                        <Image 
                          source={{ uri: participant.profile.avatar_url }} 
                          style={styles.participantAvatar}
                        />
                      ) : (
                        <View style={styles.participantAvatarPlaceholder}>
                          <Text style={styles.participantAvatarText}>
                            {participant.profile?.full_name?.charAt(0) || '?'}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.participantName}>
                        {participant.profile?.full_name || 'Unknown'}
                      </Text>
                      <Text style={styles.waitlistPosition}>
                        #{participant.waitlist_position}
                      </Text>
                    </View>
                  ))}
              </View>
            )}

            <View 
              style={styles.section}
              ref={commentsRef}
              onLayout={() => {}}
            >
              <Text style={styles.sectionTitle}>
                Comments ({comments.length})
              </Text>
              
              {comments.map((comment) => (
                <View key={comment.id} style={styles.commentRow}>
                  {comment.user?.avatar_url ? (
                    <Image 
                      source={{ uri: comment.user.avatar_url }} 
                      style={styles.commentAvatar}
                    />
                  ) : (
                    <View style={styles.commentAvatarPlaceholder}>
                      <Text style={styles.commentAvatarText}>
                        {comment.user?.full_name?.charAt(0) || '?'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.commentContent}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentAuthor}>
                        {comment.user?.full_name || 'Unknown'}
                      </Text>
                      <Text style={styles.commentTime}>
                        {formatTimestamp(comment.created_at)}
                      </Text>
                      {comment.user?.id === userId && (
                        <TouchableOpacity 
                          onPress={() => handleDeleteComment(comment.id)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons name="trash-outline" size={16} color="#DC2626" />
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={styles.commentText}>{comment.content}</Text>
                  </View>
                </View>
              ))}

              {comments.length === 0 && (
                <Text style={styles.noComments}>
                  No comments yet. Be the first to comment!
                </Text>
              )}

              <View style={styles.commentInputContainer}>
                <TextInput
                  style={styles.commentInput}
                  value={newComment}
                  onChangeText={setNewComment}
                  placeholder="Add a comment..."
                  placeholderTextColor="#AAA"
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[
                    styles.postButton,
                    (!newComment.trim() || postingComment) && styles.postButtonDisabled
                  ]}
                  onPress={handlePostComment}
                  disabled={!newComment.trim() || postingComment}
                >
                  {postingComment ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Ionicons name="send" size={20} color="white" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>

          {!isCreator && (
            <View style={styles.footer}>
              {hasJoined ? (
                <TouchableOpacity
                  style={styles.leaveButton}
                  onPress={handleLeaveRun}
                >
                  <Text style={styles.leaveButtonText}>Leave Run</Text>
                </TouchableOpacity>
              ) : isOnWaitlist ? (
                <TouchableOpacity
                  style={styles.waitlistButton}
                  onPress={handleLeaveRun}
                >
                  <Text style={styles.waitlistButtonText}>
                    On Waitlist (#{userParticipant?.waitlist_position})
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.joinButton}
                  onPress={handleJoinRun}
                >
                  <Text style={styles.joinButtonText}>
                    {isFull 
                      ? (waitlistCount > 0 ? `Join Waitlist (${waitlistCount} waiting)` : 'Join Waitlist')
                      : 'Join This Run'
                    }
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      <CreateRunModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        onRunCreated={() => {
          setShowEditModal(false)
          loadRunDetails()
        }}
        editingRun={run}
      />
    </Modal>
  )
}

function getTypeColor(type) {
  const colors = {
    'Easy': '#10B981',
    'Tempo': '#EAB308',
    'Intervals': '#EF4444',
    'Long Run': '#3B82F6',
    'Hills': '#8B5CF6',
  }
  return colors[type] || '#6B7280'
}

function getTypeBadgeColor(type) {
  const colors = {
    'Easy': '#D1FAE5',
    'Tempo': '#FEF9C3',
    'Intervals': '#FEE2E2',
    'Long Run': '#DBEAFE',
    'Hills': '#EDE9FE',
  }
  return colors[type] || '#F3F4F6'
}

function formatDate(dateString) {
  const date = new Date(dateString)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()}`
}

function formatTime(timeString) {
  const [hours, minutes] = timeString.split(':')
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${displayHour}:${minutes} ${ampm}`
}

function isPastRun(run) {
  const runDateTime = new Date(`${run.date}T${run.time}`)
  return runDateTime < new Date()
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0EA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A0F0A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  colorBar: {
    height: 4,
  },
  section: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 15,
    color: '#AAA',
    fontWeight: '400',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F0F0F',
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    padding: 16,
    borderRadius: 8,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F0F0F',
  },
  statUnit: {
    fontSize: 16,
    fontWeight: '400',
    color: '#999',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  detailText: {
    fontSize: 16,
    color: '#666',
    flex: 1,
  },
  description: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginTop: 12,
    marginBottom: 20,
  },
  progressSection: {
    marginTop: 4,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#0F0F0F',
  },
  spotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  runnersJoined: {
    fontSize: 14,
    color: '#999',
  },
  spotsLeft: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F0F0F',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F0F0F',
    marginBottom: 16,
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
  },
  mapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  mapBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  mapLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  marker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  routeUrlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    padding: 14,
    borderRadius: 8,
    gap: 10,
  },
  routeUrlText: {
    flex: 1,
    fontSize: 14,
    color: '#0F0F0F',
  },
  creatorCard: {
    flexDirection: 'row',
    gap: 12,
  },
  creatorAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  creatorAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E8E8E8',
  },
  creatorAvatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#666',
  },
  creatorInfo: {
    flex: 1,
  },
  creatorName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F0F0F',
    marginBottom: 4,
  },
  creatorCity: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  creatorBio: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  participantAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#666',
  },
  participantName: {
    fontSize: 16,
    color: '#0F0F0F',
  },
  commentRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  commentAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F0F0F',
  },
  commentTime: {
    fontSize: 12,
    color: '#999',
    flex: 1,
  },
  commentText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  noComments: {
    fontSize: 14,
    color: '#AAA',
    textAlign: 'center',
    paddingVertical: 20,
  },
  commentInputContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F0F0F',
    maxHeight: 100,
  },
  postButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#C4562A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  footer: {
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  joinButton: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#C4562A',
  },
  joinButtonDisabled: {
    opacity: 0.5,
  },
  joinButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  leaveButton: {
    backgroundColor: '#FEF2F2',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  leaveButtonText: {
    color: '#DC2626',
    fontSize: 18,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  genderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  genderBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  pastBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  pastBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  waitlistPosition: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F59E0B',
    marginLeft: 'auto',
  },
  waitlistButton: {
    backgroundColor: '#FEF3C7',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  waitlistButtonText: {
    color: '#F59E0B',
    fontSize: 18,
    fontWeight: '700',
  },
})