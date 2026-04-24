// v4 Discover. Cream surface, bolder type. Preserves:
//   - loadRuns + filters + canJoinRun gender logic
//   - join_run RPC flow
//   - Map view with display-toggle mount pattern (fixes iOS first-launch gesture freeze)
//   - FilterModal / NotificationsScreen / CreatorProfileModal / RunDetailsScreen integrations
//   - Focus-effect refresh + notification deep-link
// Adds:
//   - v4 top bar (FlocLogo + search-stub + bell + avatar)
//   - Hero "Find your flock today." with clay accent + clay micro label
//   - Horizontal chip row (ALL + type filters)
//   - Grouped sections (TODAY / THIS WEEKEND / LATER)
//   - New RunCard primitive with type stripe + scoreboard + capacity dots
//   - Floating ListMapPill above tab bar

import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import React, { useEffect, useState, useRef } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Location from 'expo-location'
import { supabase } from '../lib/supabase'
import { colors, fonts, radii, space, runTypes, runTypeMeta } from '../lib/theme'
import FlocLogo from '../components/ui/FlocLogo'
import ListMapPill from '../components/ui/ListMapPill'
import RunCard from '../components/ui/RunCard'
import MicroLabel from '../components/ui/MicroLabel'
import FilterModal from './FilterModal'
import CreatorProfileModal from './CreatorProfileModal'
import NotificationsScreen from './NotificationsScreen'
import RunDetailsScreen from './RunDetailsScreen'
import JoinedScreen from './JoinedScreen'

// DB stores canonical run types like 'Easy', 'Tempo', 'Intervals', 'Long Run', 'Hills'.
// Theme keys are lowercase: easy/tempo/intervals/long/hills. Normalize here.
function typeKey(t) {
  if (!t) return 'easy'
  const s = String(t).toLowerCase()
  if (s.startsWith('long')) return 'long'
  if (s.startsWith('hill')) return 'hills'
  if (s.startsWith('tempo')) return 'tempo'
  if (s.startsWith('interval')) return 'intervals'
  return 'easy'
}

export default function DiscoverScreen({
  onProfilePress,
  refreshTrigger,
  userProfile,
  notificationRunId,
  shouldOpenFromNotification,
  onNotificationHandled,
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
  const [typeFilter, setTypeFilter] = useState(null) // single-type chip filter
  const [joinedRun, setJoinedRun] = useState(null)
  const [joinedConfirmedCount, setJoinedConfirmedCount] = useState(0)
  const [filters, setFilters] = useState({
    minDistance: null,
    maxDistance: null,
    minPace: null,
    maxPace: null,
    types: [],
    cities: [],
  })

  const mapRef = useRef(null)

  useEffect(() => { loadUser(); loadRuns() }, [])
  useEffect(() => {
    if (refreshTrigger > 0) { setRuns([]); loadRuns() }
  }, [refreshTrigger, userId])
  useEffect(() => { setAvatarUrl(userProfile?.avatar_url || null) }, [userProfile])
  useEffect(() => { if (userId) loadUnreadCount() }, [userId])
  useEffect(() => {
    if (shouldOpenFromNotification && notificationRunId) {
      setSelectedRunId(notificationRunId)
      setShouldScrollToComments(true)
      setShowRunDetails(true)
      onNotificationHandled()
    }
  }, [shouldOpenFromNotification, notificationRunId])
  useFocusEffect(React.useCallback(() => { loadRuns(); loadUnreadCount() }, [userId]))

  async function getUserLocation() {
    setLoadingLocation(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setUserLocation({ latitude: 39.8283, longitude: -98.5795 })
        setLoadingLocation(false)
        return
      }
      const location = await Location.getCurrentPositionAsync({})
      setUserLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude })
    } catch (error) {
      console.error('Error getting location:', error)
      setUserLocation({ latitude: 39.8283, longitude: -98.5795 })
    } finally {
      setLoadingLocation(false)
    }
  }

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id)
    if (user?.id) {
      const { data: profile } = await supabase
        .from('profiles').select('gender').eq('id', user.id).single()
      setUserGender(profile?.gender)
    }
  }

  async function loadRuns() {
    try {
      const { data, error } = await supabase
        .from('runs')
        .select(`
          *,
          creator:profiles!runs_creator_id_fkey(full_name, avatar_url),
          participants:run_participants(user_id, status, waitlist_position)
        `)
        .order('date', { ascending: true })
        .order('time', { ascending: true })
      if (error) throw error
      setAllRuns(data || [])
      applyFilters(data || [], filters, typeFilter)
    } catch (error) {
      console.error('Error loading runs:', error)
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }

  async function loadUnreadCount() {
    if (!userId) return
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId).eq('read', false)
      if (error) throw error
      setUnreadCount(count || 0)
    } catch (error) { console.error('Error loading unread count:', error) }
  }

  function applyFilters(runsData, currentFilters, chipType) {
    let filtered = [...runsData]
    const now = new Date()
    filtered = filtered.filter(run => new Date(`${run.date}T${run.time}`) >= now)
    filtered = filtered.filter(run => canJoinRun(run))
    if (currentFilters.minDistance) filtered = filtered.filter(r => r.distance >= currentFilters.minDistance)
    if (currentFilters.maxDistance) filtered = filtered.filter(r => r.distance <= currentFilters.maxDistance)
    if (currentFilters.minPace) {
      const m = paceToMinutes(currentFilters.minPace)
      filtered = filtered.filter(r => paceToMinutes(r.pace) >= m)
    }
    if (currentFilters.maxPace) {
      const m = paceToMinutes(currentFilters.maxPace)
      filtered = filtered.filter(r => paceToMinutes(r.pace) <= m)
    }
    if (currentFilters.types.length > 0) filtered = filtered.filter(r => currentFilters.types.includes(r.type))
    if (currentFilters.cities.length > 0) filtered = filtered.filter(r => currentFilters.cities.includes(r.city))
    if (chipType) filtered = filtered.filter(r => typeKey(r.type) === chipType)
    setRuns(filtered)
  }

  function canJoinRun(run) {
    if (run.creator_id === userId) return true
    if (!run.gender_restriction || run.gender_restriction === 'all') return true
    if (!userGender || userGender === 'prefer_not_to_say') return false
    if (run.gender_restriction === 'women_only' && userGender === 'woman') return true
    if (run.gender_restriction === 'men_only' && userGender === 'man') return true
    if (run.gender_restriction === 'non_binary_only' && userGender === 'non_binary') return true
    return false
  }

  function paceToMinutes(pace) {
    const [m, s] = pace.split(':').map(Number)
    return m + s / 60
  }

  async function onRefresh() { setRefreshing(true); await loadRuns() }

  async function handleJoinRun(runId) {
    const run = runs.find(r => r.id === runId)
    if (run?.creator_id === userId) {
      Alert.alert('Cannot Join', "You can't join your own run!"); return
    }
    try {
      const { data, error } = await supabase.rpc('join_run', { p_run_id: runId })
      if (error) {
        if (error.code === '23505') { Alert.alert('Already Joined', "You've already joined this run") }
        else if (error.code === 'P0001') { Alert.alert('Cannot Join', "You can't join your own run!") }
        else { throw error }
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
      await loadRuns()
    } catch (error) {
      console.error('Error joining run:', error)
      Alert.alert('Error', `Could not join run: ${error?.message || 'unknown'}`)
    }
  }

  function handleApplyFilters(newFilters) {
    setFilters(newFilters)
    applyFilters(allRuns, newFilters, typeFilter)
  }

  function handleChipPress(key) {
    const next = typeFilter === key ? null : key
    setTypeFilter(next)
    applyFilters(allRuns, filters, next)
  }

  const activeFilterCount =
    (filters.minDistance ? 1 : 0) +
    (filters.maxDistance ? 1 : 0) +
    (filters.minPace ? 1 : 0) +
    (filters.maxPace ? 1 : 0) +
    filters.types.length + filters.cities.length

  // Group runs by date bucket for the sectioned list.
  const groups = React.useMemo(() => groupRuns(runs), [runs])

  // City label for hero micro. Use the user's profile city; fall back to empty.
  const cityLabel = userProfile?.city || null

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <FlocLogo size={26} color={colors.ink} accent={colors.clay} />
          <View style={{ width: 34 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.clay} />
        </View>
      </SafeAreaView>
    )
  }

  const validRunsForMap = runs.filter(run => run.lat && run.lng)
  const initialRegion = userLocation
    ? (() => {
        if (validRunsForMap.length > 0) {
          const lats = validRunsForMap.map(r => r.lat)
          const lngs = validRunsForMap.map(r => r.lng)
          const minLat = Math.min(...lats, userLocation.latitude)
          const maxLat = Math.max(...lats, userLocation.latitude)
          const minLng = Math.min(...lngs, userLocation.longitude)
          const maxLng = Math.max(...lngs, userLocation.longitude)
          const latDelta = (maxLat - minLat) * 1.5
          const lngDelta = (maxLng - minLng) * 1.5
          return {
            latitude: userLocation.latitude, longitude: userLocation.longitude,
            latitudeDelta: Math.min(Math.max(latDelta, 0.03), 0.15),
            longitudeDelta: Math.min(Math.max(lngDelta, 0.03), 0.15),
          }
        }
        return {
          latitude: userLocation.latitude, longitude: userLocation.longitude,
          latitudeDelta: 0.075, longitudeDelta: 0.075,
        }
      })()
    : { latitude: 40.7128, longitude: -74.0060, latitudeDelta: 0.075, longitudeDelta: 0.075 }

  const heroCount = runs.length

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <FlocLogo size={26} color={colors.ink} accent={colors.clay} />
        <View style={styles.topActions}>
          <Pressable style={styles.iconBtn} onPress={() => setShowFilters(true)}>
            <Ionicons name="options-outline" size={16} color={colors.ink} />
            {activeFilterCount > 0 ? (
              <View style={styles.iconBadge}>
                <Text style={styles.iconBadgeText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => setShowNotifications(true)}>
            <Ionicons name="notifications-outline" size={16} color={colors.ink} />
            {unreadCount > 0 ? <View style={styles.bellDot} /> : null}
          </Pressable>
          <Pressable onPress={onProfilePress} style={styles.avatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} key={avatarUrl} />
            ) : (
              <Text style={styles.avatarText}>
                {(userProfile?.full_name || '?').charAt(0).toUpperCase()}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroMicro}>
          {heroCount} {heroCount === 1 ? 'RUN' : 'RUNS'} NEARBY{cityLabel ? ` · ${cityLabel.toUpperCase()}` : ''}
        </Text>
        <Text style={styles.heroTitle}>
          Find your{'\n'}<Text style={styles.heroAccent}>flock</Text> today.
        </Text>
      </View>

      {/* Chip row */}
      <View style={styles.chipRowWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Pressable
            onPress={() => handleChipPress(null)}
            style={[styles.chip, !typeFilter && styles.chipActive]}
          >
            <Text style={[styles.chipText, !typeFilter && styles.chipTextActive]}>
              ALL
            </Text>
          </Pressable>
          {Object.entries(runTypes).map(([key, t]) => (
            <Pressable
              key={key}
              onPress={() => handleChipPress(key)}
              style={[styles.chip, typeFilter === key && styles.chipActiveType]}
            >
              <View style={[styles.chipDot, { backgroundColor: t.color }]} />
              <Text style={[styles.chipText, typeFilter === key && styles.chipTextActiveType]}>
                {t.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <View style={styles.pillInline} pointerEvents="box-none">
        <ListMapPill
          compact
          value={viewMode}
          onChange={(v) => {
            setViewMode(v)
            if (v === 'map' && !userLocation && !loadingLocation) getUserLocation()
          }}
        />
      </View>

      {/* List view */}
      <View style={{ flex: 1, display: viewMode === 'list' ? 'flex' : 'none' }}>
        {runs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>NOTHING NEARBY.</Text>
            <Text style={styles.emptySub}>
              {activeFilterCount > 0 || typeFilter ? 'Try adjusting your filters.' : 'Be the first dot on the map.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={groups}
            keyExtractor={(g) => g.key}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.clay} />}
            renderItem={({ item: group }) => (
              <View>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionLabel}>{group.label}</Text>
                  <View style={styles.sectionRule} />
                  <Text style={styles.sectionCount}>{group.runs.length}</Text>
                </View>
                {group.runs.map((run) => renderRun(run))}
              </View>
            )}
          />
        )}
      </View>

      {/* Map view — stays mounted for first-launch gesture fix */}
      <View style={{ flex: 1, display: viewMode === 'map' ? 'flex' : 'none' }}>
        {loadingLocation || !userLocation ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.clay} />
            <Text style={styles.mapLoadText}>Getting your location…</Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={initialRegion}
              showsUserLocation
              showsMyLocationButton
            >
              {validRunsForMap.map((run) => {
                const meta = runTypeMeta(typeKey(run.type))
                return (
                  <Marker
                    key={run.id}
                    coordinate={{ latitude: run.lat, longitude: run.lng }}
                    onPress={() => { setSelectedRunId(run.id); setShowRunDetails(true) }}
                  >
                    <View style={[styles.pin, { backgroundColor: meta.color }]}>
                      <Text style={styles.pinText}>{meta.letter}</Text>
                      <View style={[styles.pinTail, { borderTopColor: meta.color }]} />
                    </View>
                  </Marker>
                )
              })}
            </MapView>
            {validRunsForMap.length === 0 && (
              <View style={styles.emptyOverlay}>
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>NO RUNS NEARBY.</Text>
                  <Text style={styles.emptySub}>
                    {activeFilterCount > 0 ? 'Try adjusting your filters.' : 'Be the first dot on the map.'}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}
      </View>

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
        onClose={() => { setShowNotifications(false); loadUnreadCount() }}
        userId={userId}
        onNotificationPress={(runId) => {
          setSelectedRunId(runId); setShouldScrollToComments(true); setShowRunDetails(true)
        }}
      />
      <RunDetailsScreen
        visible={showRunDetails}
        onClose={() => {
          setShowRunDetails(false); setShouldScrollToComments(false)
          loadRuns(); loadUnreadCount()
        }}
        runId={selectedRunId}
        userId={userId}
        onRunUpdated={() => {
          loadRuns(); setShowRunDetails(false); setShouldScrollToComments(false)
        }}
        scrollToComments={shouldScrollToComments}
      />
      <JoinedScreen
        visible={!!joinedRun}
        run={joinedRun}
        confirmedCount={joinedConfirmedCount}
        onClose={() => setJoinedRun(null)}
      />
    </SafeAreaView>
  )

  function renderRun(run) {
    const confirmedCount = run.participants?.filter(p => p.status === 'confirmed').length || 0
    const userParticipant = run.participants?.find(p => p.user_id === userId)
    const hasJoined = userParticipant?.status === 'confirmed'
    const isOnWaitlist = userParticipant?.status === 'waitlist'
    const isOwn = run.creator_id === userId
    return (
      <RunCard
        key={run.id}
        run={{
          id: run.id,
          title: run.title,
          type: typeKey(run.type),
          distance: run.distance,
          pace: run.pace,
          spots: run.spots,
          joined_count: confirmedCount,
          meta: `${formatDateShort(run.date)} · ${formatTime(run.time)}`,
        }}
        onPress={() => { setSelectedRunId(run.id); setShowRunDetails(true) }}
        onJoin={isOwn || hasJoined || isOnWaitlist ? null : () => handleJoinRun(run.id)}
        joined={hasJoined}
        joinLabel={isOwn ? 'YOURS' : hasJoined ? 'JOINED' : isOnWaitlist ? `WAITLIST #${userParticipant?.waitlist_position || ''}`.trim() : null}
      />
    )
  }
}

// --- grouping + formatting helpers ---------------------------------------

function groupRuns(runs) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  // End of weekend = upcoming Sunday 23:59.
  const day = today.getDay() // 0 Sun..6 Sat
  const daysUntilSunday = (7 - day) % 7 // today Sunday → 0; Sat → 1
  const endOfWeekend = new Date(today); endOfWeekend.setDate(today.getDate() + daysUntilSunday); endOfWeekend.setHours(23, 59, 59, 999)
  const endOfNextWeek = new Date(today); endOfNextWeek.setDate(today.getDate() + 14)

  const buckets = {
    today: { key: 'today', label: 'TODAY', runs: [] },
    weekend: { key: 'weekend', label: 'THIS WEEKEND', runs: [] },
    next: { key: 'next', label: 'NEXT TWO WEEKS', runs: [] },
    later: { key: 'later', label: 'LATER', runs: [] },
  }

  runs.forEach((r) => {
    const dt = new Date(`${r.date}T${r.time}`)
    if (dt < tomorrow) buckets.today.runs.push(r)
    else if (dt <= endOfWeekend) buckets.weekend.runs.push(r)
    else if (dt <= endOfNextWeek) buckets.next.runs.push(r)
    else buckets.later.runs.push(r)
  })

  return Object.values(buckets).filter(b => b.runs.length > 0)
}

function formatDateShort(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const dOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  if (dOnly.getTime() === today.getTime()) return 'TODAY'
  if (dOnly.getTime() === tomorrow.getTime()) return 'TMRW'
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return `${days[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()}`
}

function formatTime(timeString) {
  const [hours, minutes] = timeString.split(':')
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${displayHour}:${minutes} ${ampm}`
}

// --- styles --------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  topBar: {
    paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 34, height: 34, borderRadius: radii.chip,
    borderWidth: 1, borderColor: colors.lineStrong,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative', backgroundColor: colors.transparent,
  },
  iconBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: colors.clay, borderRadius: 8,
    minWidth: 16, height: 16, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBadgeText: { color: colors.cream, fontSize: 10, fontFamily: fonts.displayBold },
  bellDot: {
    position: 'absolute', top: 5, right: 5,
    width: 7, height: 7, borderRadius: 999,
    backgroundColor: colors.clay, borderWidth: 1.5, borderColor: colors.cream,
  },
  avatar: {
    width: 34, height: 34, borderRadius: 999,
    backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 34, height: 34, borderRadius: 999 },
  avatarText: { color: colors.cream, fontFamily: fonts.displayBold, fontSize: 12 },
  hero: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm },
  heroMicro: {
    fontFamily: fonts.displayBold, fontSize: 10,
    letterSpacing: 1.8, color: colors.clay, marginBottom: 6,
  },
  heroTitle: {
    fontFamily: fonts.displayBold, fontSize: 38, lineHeight: 38 * 1.1,
    letterSpacing: -1.8, color: colors.ink, textTransform: 'uppercase',
  },
  heroAccent: { color: colors.clay },
  chipRowWrap: { height: 44, marginBottom: space.xs },
  chipRow: {
    paddingHorizontal: space.lg, gap: 6,
    alignItems: 'center', height: 44,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    height: 30, paddingHorizontal: 12,
    borderRadius: radii.chip, borderWidth: 1, borderColor: colors.lineStrong,
    backgroundColor: colors.transparent,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipActiveType: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipDot: { width: 6, height: 6, borderRadius: 999 },
  chipText: {
    fontFamily: fonts.displayBold, fontSize: 10,
    letterSpacing: 1.4, color: colors.ink,
  },
  chipTextActive: { color: colors.cream },
  chipTextActiveType: { color: colors.cream },
  list: { paddingHorizontal: space.md, paddingBottom: space.md },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 4, paddingTop: space.xs, paddingBottom: space.xs,
  },
  sectionLabel: {
    fontFamily: fonts.displayBold, fontSize: 9,
    letterSpacing: 2, color: colors.smoke,
  },
  sectionRule: { flex: 1, height: 1, backgroundColor: colors.line },
  sectionCount: {
    fontFamily: fonts.displayBold, fontSize: 9,
    letterSpacing: 2, color: colors.smoke,
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingBottom: 140, paddingHorizontal: space.xl,
  },
  emptyTitle: {
    fontFamily: fonts.displayBold, fontSize: 22, letterSpacing: -0.6,
    color: colors.ink, marginBottom: 6,
  },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.smoke, textAlign: 'center' },
  map: { flex: 1 },
  mapLoadText: { marginTop: 12, color: colors.smoke, fontFamily: fonts.body },
  pin: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.cream,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 3, elevation: 5,
  },
  pinText: { fontSize: 13, fontFamily: fonts.displayBold, color: colors.cream },
  pinTail: {
    position: 'absolute', bottom: -8, width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
  },
  emptyOverlay: {
    position: 'absolute', top: '35%', left: 0, right: 0,
    alignItems: 'center', paddingHorizontal: space.lg,
  },
  emptyCard: {
    backgroundColor: colors.paper, padding: space.xl,
    borderRadius: radii.card, borderWidth: 1, borderColor: colors.line,
    alignItems: 'center',
  },
  pillInline: {
    paddingHorizontal: space.lg,
    paddingTop: 4,
    paddingBottom: 0,
    alignItems: 'flex-end',
  },
})
