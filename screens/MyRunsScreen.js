import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
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
import { supabase } from '../lib/supabase'
import CreateRunModal from './CreateRunModal'
import CreatorProfileModal from './CreatorProfileModal'
import NotificationsScreen from './NotificationsScreen'
import RunDetailsScreen from './RunDetailsScreen'

export default function MyRunsScreen({ onProfilePress, userProfile }) {
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

  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    if (userId) {
      loadRuns()
      loadUnreadCount()
    }
  }, [userId, activeTab])

  useEffect(() => {
    setAvatarUrl(userProfile?.avatar_url || null)
  }, [userProfile])

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id)
  }

  function isPastRun(run) {
    const runDateTime = new Date(`${run.date}T${run.time}`)
    return runDateTime < new Date()
  }

  function sortRunsByDate(runsArray) {
    const upcoming = runsArray.filter(r => !isPastRun(r))
    const past = runsArray.filter(r => isPastRun(r))
    
    // Sort upcoming: soonest first
    upcoming.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`)
      const dateB = new Date(`${b.date}T${b.time}`)
      return dateA - dateB
    })
    
    // Sort past: most recent first
    past.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`)
      const dateB = new Date(`${b.date}T${b.time}`)
      return dateB - dateA
    })
    
    return [...upcoming, ...past]
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
        setRuns(sortRunsByDate(data || []))
      } else {
        const { data: participantData, error: participantError } = await supabase
          .from('run_participants')
          .select('run_id')
          .eq('user_id', userId)

        if (participantError) throw participantError

        const runIds = participantData.map(p => p.run_id)

        if (runIds.length > 0) {
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
          setRuns(sortRunsByDate(data || []))
        } else {
          setRuns([])
        }
      }
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

  async function onRefresh() {
    setRefreshing(true)
    await loadRuns()
  }

  async function handleDeleteRun(runId) {
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
              await loadRuns()
            } catch (error) {
              Alert.alert('Error', 'Could not delete run')
            }
          },
        },
      ]
    )
  }

  async function handleLeaveRun(runId) {
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
              await loadRuns()
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

  function handleEdit(run, e) {
    if (e) e.stopPropagation()
    setEditingRun(run)
    setShowEditModal(true)
  }

  function closeEditModal() {
    setShowEditModal(false)
    setEditingRun(null)
  }

  function renderRunCard({ item: run }) {
    const confirmedCount = run.participants?.filter(p => p.status === 'confirmed').length || 0
    const waitlistCount = run.participants?.filter(p => p.status === 'waitlist').length || 0
    const participantCount = confirmedCount
    const isFull = participantCount >= run.spots
    const isMyRun = activeTab === 'created'
    const spotsLeft = run.spots - participantCount
    const isPast = isPastRun(run)
    const userParticipant = run.participants?.find(p => p.user_id === userId)
    const isOnWaitlist = userParticipant?.status === 'waitlist' && !isMyRun

    return (
      <TouchableOpacity 
        activeOpacity={0.95}
        onPress={() => {
          setSelectedRunId(run.id)
          setShowRunDetails(true)
        }}
      >
        <View style={[styles.card, isPast && { opacity: 0.5 }]}>
          <View style={[styles.colorBar, { backgroundColor: getTypeColor(run.type) }]} />
          
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <View style={styles.badgeRow}>
                <View style={[styles.typeBadge, { backgroundColor: getTypeBadgeColor(run.type) }]}>
                  <Text style={[styles.typeText, { color: getTypeColor(run.type) }]}>
                    {run.type.toUpperCase()}
                  </Text>
                </View>
                {isPast ? (
                  <View style={styles.pastBadge}>
                    <Text style={styles.pastBadgeText}>PAST</Text>
                  </View>
                ) : run.gender_restriction && run.gender_restriction !== 'all' && (
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

              {isMyRun ? (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={(e) => handleEdit(run, e)}
                  >
                    <Text style={styles.editButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={(e) => {
                      e.stopPropagation()
                      handleDeleteRun(run.id)
                    }}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ) : isOnWaitlist ? (
                <View style={styles.waitlistStatusBadge}>
                  <Ionicons name="time-outline" size={16} color="#F59E0B" />
                  <Text style={styles.waitlistStatusText}>
                    Waitlist #{userParticipant?.waitlist_position}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.leaveButton}
                  onPress={(e) => {
                    e.stopPropagation()
                    handleLeaveRun(run.id)
                  }}
                >
                  <Text style={styles.leaveButtonText}>Leave Run</Text>
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Image source={require('../assets/floc-logo-transparent.png')} style={styles.headerLogo} />
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerButton} 
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
          <TouchableOpacity onPress={onProfilePress} style={{ marginLeft: 16 }}>
            {avatarUrl ? (
              <Image 
                source={{ uri: avatarUrl }} 
                style={{ width: 32, height: 32, borderRadius: 16 }}
                key={avatarUrl}
              />
            ) : (
              <Ionicons name="person-circle-outline" size={32} color="#666" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'created' && styles.tabActive]}
          onPress={() => {
            setActiveTab('created')
            if (activeTab !== 'created') {
              setRefreshing(true)
            }
          }}
        >
          <Text style={[styles.tabText, activeTab === 'created' && styles.tabTextActive]}>
            Created
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'joined' && styles.tabActive]}
          onPress={() => {
            setActiveTab('joined')
            if (activeTab !== 'joined') {
              setRefreshing(true)
            }
          }}
        >
          <Text style={[styles.tabText, activeTab === 'joined' && styles.tabTextActive]}>
            Joined
          </Text>
        </TouchableOpacity>
      </View>

      {runs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {activeTab === 'created' ? 'No runs created yet' : 'No runs joined yet'}
          </Text>
          <Text style={styles.emptySubtext}>
            {activeTab === 'created' ? 'Post your first run!' : 'Join a run to see it here'}
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
      )}

      <CreateRunModal
        visible={showEditModal}
        onClose={closeEditModal}
        onRunCreated={() => {
          loadRuns()
          closeEditModal()
        }}
        editingRun={editingRun}
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

      <CreatorProfileModal
        visible={showCreatorProfile}
        onClose={() => setShowCreatorProfile(false)}
        creatorId={selectedCreatorId}
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
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'white',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  tabActive: {
    backgroundColor: '#1A0F0A',
    borderColor: '#1A0F0A',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
  },
  tabTextActive: {
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
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  editButtonText: {
    color: '#0F0F0F',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteButton: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  deleteButtonText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700',
  },
  leaveButton: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  leaveButtonText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    position: 'relative',
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
  pastBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  pastBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.5,
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
  waitlistStatusBadge: {
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
  waitlistStatusText: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '700',
  },
})