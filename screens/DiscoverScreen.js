import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import React, { useEffect, useState, useRef } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import * as Location from 'expo-location'
import { supabase } from '../lib/supabase'
import FilterModal from './FilterModal'
import CreatorProfileModal from './CreatorProfileModal'
import NotificationsScreen from './NotificationsScreen'
import RunDetailsScreen from './RunDetailsScreen'

export default function DiscoverScreen({ 
  onProfilePress, 
  refreshTrigger, 
  userProfile,
  notificationRunId,
  shouldOpenFromNotification,
  onNotificationHandled
}) {
  const [runs, setRuns] = useState([])
  const [allRuns, setAllRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userId, setUserId] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [showCreatorProfile, setShowCreatorProfile] = useState(false)
  const [selectedCreatorId, setSelectedCreatorId] = useState(null)
  const [showRunDetails, setShowRunDetails] = useState(false)
  const [selectedRunId, setSelectedRunId] = useState(null)
  const [shouldScrollToComments, setShouldScrollToComments] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [viewMode, setViewMode] = useState('list')
  const [userLocation, setUserLocation] = useState(null)
  const [userGender, setUserGender] = useState(null)
  const [loadingLocation, setLoadingLocation] = useState(false)
  const [filters, setFilters] = useState({
    minDistance: null,
    maxDistance: null,
    minPace: null,
    maxPace: null,
    types: [],
    cities: [],
  })

  const mapRef = useRef(null)

  useEffect(() => {
    loadUser()
    loadRuns()
  }, [])

  useEffect(() => {
    if (refreshTrigger > 0) {
      setRuns([])
      loadRuns()
    }
  }, [refreshTrigger, userId])

  useEffect(() => {
    setAvatarUrl(userProfile?.avatar_url || null)
  }, [userProfile])

  useEffect(() => {
    if (userId) {
      loadUnreadCount()
    }
  }, [userId])

  useEffect(() => {
    if (shouldOpenFromNotification && notificationRunId) {
      setSelectedRunId(notificationRunId)
      setShouldScrollToComments(true)
      setShowRunDetails(true)
      onNotificationHandled()
    }
  }, [shouldOpenFromNotification, notificationRunId])

  useFocusEffect(
    React.useCallback(() => {
      loadRuns()
      loadUnreadCount()
    }, [userId])
  )

  async function getUserLocation() {
    setLoadingLocation(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        // Permission denied - use USA fallback
        setUserLocation({
          latitude: 39.8283, // Center of USA
          longitude: -98.5795,
        })
        setLoadingLocation(false)
        return
      }

      const location = await Location.getCurrentPositionAsync({})
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      })
    } catch (error) {
      console.error('Error getting location:', error)
      // Error - use USA fallback
      setUserLocation({
        latitude: 39.8283,
        longitude: -98.5795,
      })
    } finally {
      setLoadingLocation(false)
    }
  }

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id)
    
    if (user?.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('gender')
        .eq('id', user.id)
        .single()
      
      setUserGender(profile?.gender)
    }
  }

  async function loadRuns() {
    try {
      let query = supabase
        .from('runs')
        .select(`
          *,
          creator:profiles!runs_creator_id_fkey(full_name, avatar_url),
          participants:run_participants(user_id, status, waitlist_position)
        `)
      
      
      
      const { data, error } = await query
        .order('date', { ascending: true })
        .order('time', { ascending: true })

      if (error) throw error
      setAllRuns(data || [])
      applyFilters(data || [], filters)
    } catch (error) {
      console.error('Error loading runs:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

 async function loadUnreadCount() {
    if (!userId) return
    
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false)

      if (error) throw error
      setUnreadCount(count || 0)
    } catch (error) {
      console.error('Error loading unread count:', error)
    }
  } 

  function applyFilters(runsData, currentFilters) {
    let filtered = [...runsData]

    const now = new Date()
    filtered = filtered.filter(run => {
      const runDateTime = new Date(`${run.date}T${run.time}`)
      return runDateTime >= now
    })

    // Filter by gender restriction
    filtered = filtered.filter(run => canJoinRun(run))

    if (currentFilters.minDistance) {
      filtered = filtered.filter(run => run.distance >= currentFilters.minDistance)
    }

    if (currentFilters.maxDistance) {
      filtered = filtered.filter(run => run.distance <= currentFilters.maxDistance)
    }

    if (currentFilters.minPace) {
      const minPaceMinutes = paceToMinutes(currentFilters.minPace)
      filtered = filtered.filter(run => paceToMinutes(run.pace) >= minPaceMinutes)
    }

    if (currentFilters.maxPace) {
      const maxPaceMinutes = paceToMinutes(currentFilters.maxPace)
      filtered = filtered.filter(run => paceToMinutes(run.pace) <= maxPaceMinutes)
    }

    if (currentFilters.types.length > 0) {
      filtered = filtered.filter(run => currentFilters.types.includes(run.type))
    }

    if (currentFilters.cities.length > 0) {
      filtered = filtered.filter(run => currentFilters.cities.includes(run.city))
    }

    setRuns(filtered)
  }

  function canJoinRun(run) {
    // Creator can always see their own run
    if (run.creator_id === userId) return true
    
    // No gender restriction - everyone can join
    if (!run.gender_restriction || run.gender_restriction === 'all') return true
    
    // User hasn't set gender - can't join restricted runs
    if (!userGender || userGender === 'prefer_not_to_say') return false
    
    // Check gender match
    if (run.gender_restriction === 'women_only' && userGender === 'woman') return true
    if (run.gender_restriction === 'men_only' && userGender === 'man') return true
    if (run.gender_restriction === 'non_binary_only' && userGender === 'non_binary') return true
    
    return false
  }

  function paceToMinutes(pace) {
    const [minutes, seconds] = pace.split(':').map(Number)
    return minutes + seconds / 60
  }

  async function onRefresh() {
    setRefreshing(true)
    await loadRuns()
  }

  async function handleJoinRun(runId) {
    // Prevent joining own run
    const run = runs.find(r => r.id === runId)
    if (run?.creator_id === userId) {
      Alert.alert('Cannot Join', "You can't join your own run!")
      return
    }
    
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

      await loadRuns()
    } catch (error) {
      console.error('Error joining run:', error)
      Alert.alert('Error', 'Could not join run')
    }
  }

  function handleApplyFilters(newFilters) {
    setFilters(newFilters)
    applyFilters(allRuns, newFilters)
  }

  function getMarkerColor(type) {
    const colors = {
      'Easy': '#10B981',
      'Tempo': '#EAB308',
      'Intervals': '#EF4444',
      'Long Run': '#3B82F6',
      'Hills': '#8B5CF6',
    }
    return colors[type] || '#6B7280'
  }
  function getRunInitial(type) {
  const initials = {
    'Easy': 'E',
    'Tempo': 'T',
    'Intervals': 'I',
    'Long Run': 'L',
    'Hills': 'H',
  }
  return initials[type] || '·'
}

  const activeFilterCount = 
    (filters.minDistance ? 1 : 0) + 
    (filters.maxDistance ? 1 : 0) + 
    (filters.minPace ? 1 : 0) + 
    (filters.maxPace ? 1 : 0) + 
    filters.types.length +
    filters.cities.length

  function renderRunCard({ item: run }) {
    const confirmedCount = run.participants?.filter(p => p.status === 'confirmed').length || 0
    const waitlistCount = run.participants?.filter(p => p.status === 'waitlist').length || 0
    const participantCount = confirmedCount
    const spotsLeft = run.spots - participantCount
    const isFull = participantCount >= run.spots
    const userParticipant = run.participants?.find(p => p.user_id === userId)
    const hasJoined = userParticipant?.status === 'confirmed'
    const isOnWaitlist = userParticipant?.status === 'waitlist'

    return (
      <TouchableOpacity 
        activeOpacity={0.95}
        onPress={() => {
          setSelectedRunId(run.id)
          setShowRunDetails(true)
        }}
      >
        <View style={styles.card}>
          <View style={[styles.colorBar, { backgroundColor: getTypeColor(run.type) }]} />
          
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <View style={styles.badgeRow}>
                <View style={[styles.typeBadge, { backgroundColor: getTypeBadgeColor(run.type) }]}>
                  <Text style={[styles.typeText, { color: getTypeColor(run.type) }]}>
                    {run.type.toUpperCase()}
                  </Text>
                </View>
                {!isPastRun(run) && run.gender_restriction && run.gender_restriction !== 'all' && (
                  <View style={styles.genderBadge}>
                    <Ionicons name="shield-checkmark" size={12} color="#666" />
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
              <Ionicons name="calendar" size={16} color="#999" />
              <Text style={styles.detailText}>
                {formatDate(run.date)} · {formatTime(run.time)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="location-sharp" size={16} color="#999" />
              <Text style={styles.detailText}>{run.meeting_point}</Text>
            </View>

            {run.description && (
              <Text style={styles.description} numberOfLines={2}>
                {run.description}
              </Text>
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

            <View style={styles.footer}>
              <TouchableOpacity 
                style={styles.creatorInfo}
                onPress={(e) => {
                  e.stopPropagation()
                  setSelectedCreatorId(run.creator_id)
                  setShowCreatorProfile(true)
                }}
              >
                {run.creator?.avatar_url ? (
                  <Image 
                    source={{ uri: run.creator.avatar_url }} 
                    style={styles.avatarImage}
                  />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {run.creator?.full_name?.charAt(0) || '?'}
                    </Text>
                  </View>
                )}
                <Text style={styles.creatorName}>{run.creator?.full_name || 'Unknown'}</Text>
              </TouchableOpacity>

              {run.creator_id === userId ? (
                <View style={styles.yourRunBadge}>
                  <Text style={styles.yourRunText}>Your Run</Text>
                </View>
              ) : hasJoined ? (
                <View style={styles.joinedButton}>
                  <Ionicons name="checkmark" size={16} color="#10B981" />
                  <Text style={styles.joinedButtonText}>Joined</Text>
                </View>
              ) : isOnWaitlist ? (
                <View style={styles.waitlistBadge}>
                  <Ionicons name="time-outline" size={16} color="#F59E0B" />
                  <Text style={styles.waitlistBadgeText}>
                    Waitlist #{userParticipant?.waitlist_position}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.joinButton}
                  onPress={(e) => {
                    e.stopPropagation()
                    handleJoinRun(run.id)
                  }}
                >
                  <Ionicons 
                    name={isFull ? "time-outline" : "add-circle"} 
                    size={20} 
                    color="white" 
                  />
                  <Text style={styles.joinButtonText}>
                    {isFull ? 'Join Waitlist' : 'Join'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View>
            <Image source={require('../assets/floc-logo-transparent.png')} style={styles.headerLogo} />
          </View>
          <TouchableOpacity onPress={onProfilePress}>
            <Ionicons name="person-circle-outline" size={32} color="#666" />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#C4562A" />
        </View>
      </SafeAreaView>
    )
  }

  const validRunsForMap = runs.filter(run => run.lat && run.lng)
  // Always center on user location first, then calculate radius
  const initialRegion = userLocation
    ? (() => {
        // If there are runs, calculate bounds to show them all
        if (validRunsForMap.length > 0) {
          const lats = validRunsForMap.map(r => r.lat)
          const lngs = validRunsForMap.map(r => r.lng)
          const minLat = Math.min(...lats, userLocation.latitude)
          const maxLat = Math.max(...lats, userLocation.latitude)
          const minLng = Math.min(...lngs, userLocation.longitude)
          const maxLng = Math.max(...lngs, userLocation.longitude)
          
          const latDelta = (maxLat - minLat) * 1.5 // 50% padding
          const lngDelta = (maxLng - minLng) * 1.5
          
          return {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: Math.min(Math.max(latDelta, 0.03), 0.15), // Min 2 miles, max 10 miles
            longitudeDelta: Math.min(Math.max(lngDelta, 0.03), 0.15),
          }
        }
        
        // No runs - show ~10 mile radius around user
        return {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.075, // ~5 mile radius (10 mile diameter)
          longitudeDelta: 0.075,
        }
      })()
    : {
        // Fallback to NYC if no user location
        latitude: 40.7128,
        longitude: -74.0060,
        latitudeDelta: 0.075,
        longitudeDelta: 0.075,
      }
  

  return (
    <SafeAreaView style={styles.container}>
  <View style={styles.header}>
        <View>
          <Image source={require('../assets/floc-logo-transparent.png')} style={styles.headerLogo} />
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={() => setShowFilters(true)}
          >
            <Ionicons name="options" size={24} color="#666" />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.headerButton, { marginLeft: 16 }]} 
            onPress={() => setShowNotifications(true)}
          >
            <Ionicons name="notifications-outline" size={24} color="#666" />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={onProfilePress}>
            {avatarUrl ? (
              <Image 
                source={{ uri: avatarUrl }} 
                style={{ width: 32, height: 32, borderRadius: 16, marginLeft: 12 }}
                key={avatarUrl}
              />
            ) : (
              <Ionicons name="person-circle-outline" size={32} color="#666" style={{ marginLeft: 12 }} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
          onPress={() => setViewMode('list')}
        >
          <Ionicons 
            name="list" 
            size={20} 
            color={viewMode === 'list' ? '#FFF' : '#666'} 
          />
          <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>
            List
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'map' && styles.toggleButtonActive]}
          onPress={() => {
            setViewMode('map')
            if (!userLocation && !loadingLocation) {
              getUserLocation()
            }
          }}
        >
          <Ionicons 
            name="map" 
            size={20} 
            color={viewMode === 'map' ? '#FFF' : '#666'} 
          />
          <Text style={[styles.toggleText, viewMode === 'map' && styles.toggleTextActive]}>
            Map
          </Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'list' ? (
        runs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No runs found</Text>
            <Text style={styles.emptySubtext}>
              {activeFilterCount > 0 ? 'Try adjusting your filters' : 'Be the first to post a run!'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={runs}
            renderItem={renderRunCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        )

     ) : (
        <View style={{ flex: 1 }}>
          {loadingLocation ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#C4562A" />
              <Text style={{ marginTop: 12, color: '#666' }}>Getting your location...</Text>
            </View>
          ) : userLocation ? (
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={initialRegion}
              showsUserLocation={true}
              showsMyLocationButton={true}
              onMapReady={() => {
                // Nudge the map once it's ready. Works around an iOS
                // react-native-maps bug where gestures are blocked on
                // first launch until the region is updated.
                if (mapRef.current) {
                  mapRef.current.animateToRegion(initialRegion, 150)
                }
              }}
            >
              {validRunsForMap.map((run) => (
                <Marker
                  key={run.id}
                  coordinate={{ latitude: run.lat, longitude: run.lng }}
                  onPress={() => {
                    setSelectedRunId(run.id)
                    setShowRunDetails(true)
                  }}
                >
                <View style={[styles.pin, { backgroundColor: getMarkerColor(run.type) }]}>
                  <Text style={styles.pinText}>{getRunInitial(run.type)}</Text>
                  <View style={[styles.pinTail, { borderTopColor: getMarkerColor(run.type) }]} />
                </View>
              </Marker>
              ))}
            </MapView>
          ) : (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#C4562A" />
              <Text style={{ marginTop: 12, color: '#666' }}>Getting your location...</Text>
            </View>
          )}

          {validRunsForMap.length === 0 && initialRegion && (
            <View style={styles.emptyOverlay}>
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No runs found</Text>
                <Text style={styles.emptySubtext}>
                  {activeFilterCount > 0 ? 'Try adjusting your filters' : 'No runs posted yet'}
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      <FilterModal
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        onApply={handleApplyFilters}
        currentFilters={filters}
        allRuns={allRuns}
      />

      <CreatorProfileModal
        visible={showCreatorProfile}
        onClose={() => setShowCreatorProfile(false)}
        creatorId={selectedCreatorId}
      />

      <NotificationsScreen
        visible={showNotifications}
        onClose={() => {
          setShowNotifications(false)
          loadUnreadCount()
        }}
        userId={userId}
        onNotificationPress={(runId) => {
          setSelectedRunId(runId)
          setShouldScrollToComments(true)
          setShowRunDetails(true)
        }}
      />

      <RunDetailsScreen
        visible={showRunDetails}
        onClose={() => {
          setShowRunDetails(false)
          setShouldScrollToComments(false)
          loadRuns() // Reload runs when closing
          loadUnreadCount() // Reload unread count
        }}
        runId={selectedRunId}
        userId={userId}
        onRunUpdated={() => {
          loadRuns()
          setShowRunDetails(false)
          setShouldScrollToComments(false)
        }}
        scrollToComments={shouldScrollToComments}
      />
    </SafeAreaView>
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#F5F0EA',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -1,
    color: '#1A0F0A',
  },
  headerLogo: {
    width: 72,
    height: 35,
    resizeMode: 'contain',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
  viewToggle: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  toggleButtonActive: {
    backgroundColor: '#1A0F0A',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  toggleTextActive: {
    color: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#AAA',
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  map: {
    flex: 1,
  },
  pin: {
  width: 34,
  height: 34,
  borderRadius: 17,
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
pinText: {
  fontSize: 13,
  fontWeight: '700',
  color: 'white',
},
pinTail: {
  position: 'absolute',
  bottom: -8,
  width: 0,
  height: 0,
  borderLeftWidth: 5,
  borderRightWidth: 5,
  borderTopWidth: 8,
  borderLeftColor: 'transparent',
  borderRightColor: 'transparent',
},
  emptyOverlay: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyCard: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    alignItems: 'center',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  colorBar: {
    height: 4,
  },
  cardContent: {
    padding: 20,
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
    fontSize: 22,
    fontWeight: '800',
    color: '#0F0F0F',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    padding: 12,
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
    fontSize: 24,
    fontWeight: '700',
    color: '#0F0F0F',
  },
  statUnit: {
    fontSize: 14,
    fontWeight: '400',
    color: '#999',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  progressSection: {
    marginTop: 16,
    marginBottom: 16,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#0F0F0F',
  },
  spotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  runnersJoined: {
    fontSize: 13,
    color: '#999',
  },
  spotsLeft: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F0F0F',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  creatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E8E8E8',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#666',
  },
  creatorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F0F0F',
  },
  joinedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  joinedButtonText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '700',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: 'white',
    fontSize: 10,
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
  },
  genderBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
  },
  yourRunBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  yourRunText: {
    color: '#0F0F0F',
    fontSize: 13,
    fontWeight: '700',
  },
  waitlistBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  waitlistBadgeText: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '700',
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F0F0F',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  joinButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
  },
})