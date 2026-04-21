import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'

export default function CreatorProfileModal({ visible, onClose, creatorId }) {
  const [loading, setLoading] = useState(true)
  const [creator, setCreator] = useState(null)
  const [runs, setRuns] = useState([])
  const [totalParticipants, setTotalParticipants] = useState(0)

  useEffect(() => {
    if (visible && creatorId) {
      loadCreatorData()
    }
  }, [visible, creatorId])

  async function loadCreatorData() {
    setLoading(true)
    try {
      // Load creator profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, city, bio, gender')
        .eq('id', creatorId)
        .maybeSingle()

      if (profileError) throw profileError
      setCreator(profileData)

      // Load creator's runs with participant counts
      const { data: runsData, error: runsError } = await supabase
        .from('runs')
        .select(`
          *,
          participants:run_participants(user_id)
        `)
        .eq('creator_id', creatorId)
        .order('date', { ascending: false })

      if (runsError) throw runsError
      setRuns(runsData || [])

      // Calculate total participants
      const total = (runsData || []).reduce((sum, run) => {
        return sum + (run.participants?.length || 0)
      }, 0)
      setTotalParticipants(total)
    } catch (error) {
      console.error('Error loading creator data:', error)
    } finally {
      setLoading(false)
    }
  }

  function renderRunCard({ item: run }) {
    const participantCount = run.participants?.length || 0
    const spotsLeft = run.spots - participantCount

    return (
      <View style={styles.runCard}>
        <View style={[styles.colorBar, { backgroundColor: getTypeColor(run.type) }]} />
        
        <View style={styles.runContent}>
          <View style={styles.runHeader}>
            <View style={[styles.typeBadge, { backgroundColor: getTypeBadgeColor(run.type) }]}>
              <Text style={[styles.typeText, { color: getTypeColor(run.type) }]}>
                {run.type.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.neighborhoodText}>{run.neighborhood}</Text>
          </View>

          <Text style={styles.runTitle}>{run.title}</Text>

          <View style={styles.runStats}>
            <Text style={styles.runStat}>{run.distance} mi</Text>
            <Text style={styles.runStat}>•</Text>
            <Text style={styles.runStat}>{run.pace}/mi</Text>
            <Text style={styles.runStat}>•</Text>
            <Text style={styles.runStat}>{formatDate(run.date)}</Text>
          </View>

          <View style={styles.runFooter}>
            <Text style={styles.participantText}>{participantCount} joined</Text>
            <Text style={[styles.spotsText, { color: getTypeColor(run.type) }]}>
              {spotsLeft} spots left
            </Text>
          </View>
        </View>
      </View>
    )
  }

  if (loading) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0F0F0F" />
          </View>
        </SafeAreaView>
      </Modal>
    )
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={28} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.profileSection}>
          {creator?.avatar_url ? (
            <Image 
              source={{ uri: creator.avatar_url }} 
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {creator?.full_name?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          )}

          <Text style={styles.name}>{creator?.full_name || 'Unknown'}</Text>
          
          {creator?.city && creator?.neighborhood && (
            <View style={styles.locationRow}>
              <Ionicons name="location-sharp" size={16} color="#999" />
              <Text style={styles.location}>
                {creator.neighborhood}, {creator.city}
              </Text>
            </View>
          )}

          {creator?.bio && (
            <Text style={styles.bio}>{creator.bio}</Text>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{runs.length}</Text>
              <Text style={styles.statLabel}>Runs Posted</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{totalParticipants}</Text>
              <Text style={styles.statLabel}>Total Participants</Text>
            </View>
          </View>
        </View>

        <View style={styles.runsSection}>
          <Text style={styles.sectionTitle}>Posted Runs</Text>
          {runs.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No runs posted yet</Text>
            </View>
          ) : (
            <FlatList
              data={runs}
              renderItem={renderRunCard}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.runsList}
            />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  )
}

function getTypeColor(type) {
  const colors = {
    'Easy': '#10B981',
    'Tempo': '#F59E0B',
    'Intervals': '#EF4444',
    'Long Run': '#3B82F6',
    'Hills': '#8B5CF6',
  }
  return colors[type] || '#6B7280'
}

function getTypeBadgeColor(type) {
  const colors = {
    'Easy': '#D1FAE5',
    'Tempo': '#FEF3C7',
    'Intervals': '#FEE2E2',
    'Long Run': '#DBEAFE',
    'Hills': '#EDE9FE',
  }
  return colors[type] || '#F3F4F6'
}

function formatDate(dateString) {
  const date = new Date(dateString)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[date.getMonth()]} ${date.getDate()}`
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileSection: {
    backgroundColor: 'white',
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#666',
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F0F0F',
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  location: {
    fontSize: 15,
    color: '#999',
  },
  bio: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 24,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F0F0F',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#999',
  },
  runsSection: {
    flex: 1,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F0F0F',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 15,
    color: '#AAA',
  },
  runsList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  runCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  colorBar: {
    height: 3,
  },
  runContent: {
    padding: 16,
  },
  runHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  neighborhoodText: {
    fontSize: 13,
    color: '#AAA',
  },
  runTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F0F0F',
    marginBottom: 8,
  },
  runStats: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  runStat: {
    fontSize: 13,
    color: '#666',
  },
  runFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  participantText: {
    fontSize: 12,
    color: '#999',
  },
  spotsText: {
    fontSize: 12,
    fontWeight: '600',
  },
})