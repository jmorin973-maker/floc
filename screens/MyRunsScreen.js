// v4 My Runs. Same top-bar + hero pattern as Discover, with a segmented
// Created/Joined toggle, UPCOMING/PAST section headers, and RunCard primitives.
// For the Created tab, a small Edit/Delete action row sits below each card.
// Empty states use the clay-dot + big uppercase copy treatment.

import { Ionicons } from '@expo/vector-icons'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, FlatList, Image, Pressable,
  RefreshControl, StyleSheet, Text, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { colors, fonts, radii, space } from '../lib/theme'
import FlocLogo from '../components/ui/FlocLogo'
import RunCard from '../components/ui/RunCard'
import CreateRunModal from './CreateRunModal'
import CreatorProfileModal from './CreatorProfileModal'
import NotificationsScreen from './NotificationsScreen'
import RunDetailsScreen from './RunDetailsScreen'

function typeKey(t) {
  if (!t) return 'easy'
  const s = String(t).toLowerCase()
  if (s.startsWith('long')) return 'long'
  if (s.startsWith('hill')) return 'hills'
  if (s.startsWith('tempo')) return 'tempo'
  if (s.startsWith('interval')) return 'intervals'
  return 'easy'
}

export default function MyRunsScreen({ onProfilePress, userProfile, onGoDiscover }) {
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('created')
  const [userId, setUserId] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingRun, setEditingRun] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [showCreatorProfile, setShowCreatorProfile] = useState(false)
  const [selectedCreatorId, setSelectedCreatorId] = useState(null)
  const [showRunDetails, setShowRunDetails] = useState(false)
  const [selectedRunId, setSelectedRunId] = useState(null)
  const [shouldScrollToComments, setShouldScrollToComments] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => { loadUser() }, [])
  useEffect(() => { if (userId) { loadRuns(); loadUnreadCount() } }, [userId, activeTab])
  useEffect(() => { setAvatarUrl(userProfile?.avatar_url || null) }, [userProfile])

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id)
  }

  function isPastRun(run) {
    return new Date(`${run.date}T${run.time}`) < new Date()
  }

  async function loadRuns() {
    try {
      if (activeTab === 'created') {
        const { data, error } = await supabase
          .from('runs')
          .select(`
            *,
            creator:profiles!runs_creator_id_fkey(full_name, avatar_url),
            participants:run_participants(user_id, status, waitlist_position)
          `)
          .eq('creator_id', userId)
          .order('date', { ascending: true })
          .order('time', { ascending: true })
        if (error) throw error
        setRuns(data || [])
      } else {
        const { data: participantData, error: pErr } = await supabase
          .from('run_participants').select('run_id').eq('user_id', userId)
        if (pErr) throw pErr
        const runIds = participantData.map(p => p.run_id)
        if (!runIds.length) { setRuns([]); return }
        const { data, error } = await supabase
          .from('runs')
          .select(`
            *,
            creator:profiles!runs_creator_id_fkey(full_name, avatar_url),
            participants:run_participants(user_id, status, waitlist_position)
          `)
          .in('id', runIds)
          .order('date', { ascending: true })
          .order('time', { ascending: true })
        if (error) throw error
        setRuns(data || [])
      }
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

  async function onRefresh() { setRefreshing(true); await loadRuns() }

  function handleDeleteRun(runId) {
    Alert.alert('Delete Run', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const { error } = await supabase.from('runs').delete().eq('id', runId)
          if (error) throw error
          await loadRuns()
        } catch (error) { Alert.alert('Error', 'Could not delete run') }
      } },
    ])
  }

  function handleLeaveRun(runId) {
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
          } catch (fnErr) { console.error('process-waitlist:', fnErr) }
          await loadRuns()
        } catch (error) {
          Alert.alert('Error', `Could not leave run: ${error?.message || 'unknown'}`)
        }
      } },
    ])
  }

  // Split into upcoming (soonest first) and past (most recent first).
  const { upcoming, past } = React.useMemo(() => {
    const up = [], pa = []
    runs.forEach(r => (isPastRun(r) ? pa : up).push(r))
    up.sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`))
    pa.sort((a, b) => new Date(`${b.date}T${b.time}`) - new Date(`${a.date}T${a.time}`))
    return { upcoming: up, past: pa }
  }, [runs])

  const sections = React.useMemo(() => {
    const s = []
    if (upcoming.length) s.push({ key: 'upcoming', label: 'UPCOMING', runs: upcoming })
    if (past.length) s.push({ key: 'past', label: 'PAST', runs: past })
    return s
  }, [upcoming, past])

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <TopBar
          avatarUrl={avatarUrl}
          userProfile={userProfile}
          unreadCount={unreadCount}
          onProfilePress={onProfilePress}
          onBellPress={() => setShowNotifications(true)}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.clay} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <TopBar
        avatarUrl={avatarUrl}
        userProfile={userProfile}
        unreadCount={unreadCount}
        onProfilePress={onProfilePress}
        onBellPress={() => setShowNotifications(true)}
      />

      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroMicro}>
          {runs.length} {runs.length === 1 ? 'RUN' : 'RUNS'}
          {activeTab === 'created' ? ' POSTED' : ' JOINED'}
        </Text>
        <Text style={styles.heroTitle}>
          Your{'\n'}<Text style={styles.heroAccent}>runs.</Text>
        </Text>
      </View>

      {/* Segmented tabs */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, activeTab === 'created' && styles.tabActive]}
          onPress={() => { if (activeTab !== 'created') { setActiveTab('created'); setLoading(true) } }}
        >
          <Text style={[styles.tabText, activeTab === 'created' && styles.tabTextActive]}>
            CREATED
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'joined' && styles.tabActive]}
          onPress={() => { if (activeTab !== 'joined') { setActiveTab('joined'); setLoading(true) } }}
        >
          <Text style={[styles.tabText, activeTab === 'joined' && styles.tabTextActive]}>
            JOINED
          </Text>
        </Pressable>
      </View>

      {runs.length === 0 ? (
        <EmptyState
          tab={activeTab}
          onCTA={onGoDiscover}
        />
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(s) => s.key}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.clay} />}
          renderItem={({ item: section }) => (
            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>{section.label}</Text>
                <View style={styles.sectionRule} />
                <Text style={styles.sectionCount}>{section.runs.length}</Text>
              </View>
              {section.runs.map((run) => renderRun(run, section.key === 'past'))}
            </View>
          )}
        />
      )}

      <CreateRunModal
        visible={showEditModal}
        onClose={() => { setShowEditModal(false); setEditingRun(null) }}
        onRunCreated={() => { loadRuns(); setShowEditModal(false); setEditingRun(null) }}
        editingRun={editingRun}
      />
      <NotificationsScreen
        visible={showNotifications}
        onClose={() => { setShowNotifications(false); loadUnreadCount() }}
        userId={userId}
        onNotificationPress={(runId) => {
          setSelectedRunId(runId); setShouldScrollToComments(true); setShowRunDetails(true)
        }}
      />
      <CreatorProfileModal
        visible={showCreatorProfile}
        onClose={() => setShowCreatorProfile(false)}
        creatorId={selectedCreatorId}
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
    </SafeAreaView>
  )

  function renderRun(run, past) {
    const confirmedCount = run.participants?.filter(p => p.status === 'confirmed').length || 0
    const userParticipant = run.participants?.find(p => p.user_id === userId)
    const isOnWaitlist = userParticipant?.status === 'waitlist'
    const isMyRun = activeTab === 'created'

    return (
      <View key={run.id} style={[{ opacity: past ? 0.55 : 1 }]}>
        <RunCard
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
          onJoin={null}
        />
        {/* Action row below card */}
        <View style={styles.actionRow}>
          {isMyRun ? (
            <>
              {!past ? (
                <Pressable
                  style={styles.btnGhost}
                  onPress={() => { setEditingRun(run); setShowEditModal(true) }}
                >
                  <Ionicons name="create-outline" size={13} color={colors.ink} />
                  <Text style={styles.btnGhostText}>EDIT</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.btnDanger} onPress={() => handleDeleteRun(run.id)}>
                <Ionicons name="trash-outline" size={13} color={colors.clay} />
                <Text style={styles.btnDangerText}>DELETE</Text>
              </Pressable>
            </>
          ) : isOnWaitlist ? (
            <View style={styles.waitlistTag}>
              <Ionicons name="time-outline" size={13} color={colors.clay} />
              <Text style={styles.waitlistTagText}>
                WAITLIST #{userParticipant?.waitlist_position || ''}
              </Text>
            </View>
          ) : !past ? (
            <Pressable style={styles.btnDanger} onPress={() => handleLeaveRun(run.id)}>
              <Text style={styles.btnDangerText}>LEAVE RUN</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    )
  }
}

// --- small components ----------------------------------------------------

function TopBar({ avatarUrl, userProfile, unreadCount, onProfilePress, onBellPress }) {
  return (
    <View style={styles.topBar}>
      <FlocLogo size={26} color={colors.ink} accent={colors.clay} />
      <View style={styles.topActions}>
        <Pressable style={styles.iconBtn} onPress={onBellPress}>
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
  )
}

function EmptyState({ tab, onCTA }) {
  const isCreated = tab === 'created'
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyDots}>
        <View style={[styles.emptyDot, { backgroundColor: colors.clay, opacity: 0.9 }]} />
        <View style={[styles.emptyDot, { backgroundColor: colors.moss, opacity: 0.5 }]} />
        <View style={[styles.emptyDotOutline]} />
      </View>
      <View style={styles.emptyMicroRow}>
        <View style={styles.emptyMicroDot} />
        <Text style={styles.emptyMicro}>
          {isCreated ? 'NOTHING POSTED' : 'NO RUNS YET'}
        </Text>
      </View>
      <Text style={styles.emptyTitle}>
        {isCreated ? 'Post your\nfirst run.' : 'Join the\nflock.'}
      </Text>
      <Text style={styles.emptySub}>
        {isCreated
          ? 'Pick a pace, drop a pin, wait for the flock to gather.'
          : 'Find a run nearby and tap Join. We\'ll remind you the night before.'}
      </Text>
      {onCTA && !isCreated ? (
        <Pressable style={styles.emptyCta} onPress={onCTA}>
          <Text style={styles.emptyCtaText}>DISCOVER RUNS</Text>
          <Ionicons name="arrow-forward" size={13} color={colors.cream} />
        </Pressable>
      ) : null}
    </View>
  )
}

// --- formatting helpers --------------------------------------------------

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
  const [hh, mm] = timeString.split(':')
  const hour = parseInt(hh, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${display}:${mm} ${ampm}`
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
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
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

  tabRow: {
    flexDirection: 'row', paddingHorizontal: space.lg,
    paddingTop: space.sm, paddingBottom: space.sm, gap: 8,
  },
  tab: {
    flex: 1, height: 38, borderRadius: radii.chip,
    borderWidth: 1, borderColor: colors.lineStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  tabActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  tabText: {
    fontFamily: fonts.displayBold, fontSize: 11,
    letterSpacing: 1.6, color: colors.ink,
  },
  tabTextActive: { color: colors.cream },

  list: { paddingHorizontal: space.md, paddingBottom: space.md },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 4, paddingTop: space.sm, paddingBottom: space.xs,
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

  actionRow: {
    flexDirection: 'row', gap: 8, justifyContent: 'flex-end',
    marginTop: -4, marginBottom: space.sm,
  },
  btnGhost: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, height: 34, borderRadius: radii.button,
    borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.paper,
  },
  btnGhostText: {
    fontFamily: fonts.displayBold, fontSize: 10,
    letterSpacing: 1.6, color: colors.ink,
  },
  btnDanger: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, height: 34, borderRadius: radii.button,
    borderWidth: 1, borderColor: 'rgba(194,74,46,0.25)',
    backgroundColor: 'rgba(194,74,46,0.08)',
  },
  btnDangerText: {
    fontFamily: fonts.displayBold, fontSize: 10,
    letterSpacing: 1.6, color: colors.clay,
  },
  waitlistTag: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, height: 34, borderRadius: radii.button,
    borderWidth: 1, borderColor: 'rgba(194,74,46,0.25)',
    backgroundColor: 'rgba(194,74,46,0.08)',
  },
  waitlistTagText: {
    fontFamily: fonts.displayBold, fontSize: 10,
    letterSpacing: 1.6, color: colors.clay,
  },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Empty state
  emptyWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: space.xl, paddingBottom: 140,
  },
  emptyDots: {
    flexDirection: 'row', gap: 10, marginBottom: space.lg,
  },
  emptyDot: { width: 14, height: 14, borderRadius: 7 },
  emptyDotOutline: {
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 1.5, borderColor: colors.lineStrong, borderStyle: 'dashed',
  },
  emptyMicroRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10,
  },
  emptyMicro: {
    fontFamily: fonts.displayBold, fontSize: 10,
    letterSpacing: 1.8, color: colors.clay,
  },
  emptyMicroDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: colors.clay,
  },
  emptyTitle: {
    fontFamily: fonts.displayBold, fontSize: 38, lineHeight: 38 * 1.1,
    letterSpacing: -1.8, color: colors.ink, textTransform: 'uppercase',
    textAlign: 'center', marginBottom: space.sm,
  },
  emptySub: {
    fontFamily: fonts.body, fontSize: 14, lineHeight: 21,
    color: colors.smoke, textAlign: 'center', maxWidth: 300,
  },
  emptyCta: {
    marginTop: space.xl,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 48, paddingHorizontal: 22, borderRadius: radii.button,
    backgroundColor: colors.clay,
  },
  emptyCtaText: {
    fontFamily: fonts.displayBold, fontSize: 12,
    letterSpacing: 1.8, color: colors.cream,
  },
})
