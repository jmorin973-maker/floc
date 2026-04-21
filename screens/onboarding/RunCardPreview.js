import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

export default function RunCardPreview() {
  return (
    <View style={styles.card}>
      <View style={[styles.colorBar, { backgroundColor: '#10B981' }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={[styles.typeBadge, { backgroundColor: '#D1FAE5' }]}>
            <Text style={[styles.typeText, { color: '#10B981' }]}>EASY</Text>
          </View>
          <View style={styles.locationBadge}>
            <Ionicons name="location-sharp" size={14} color="#AAA" />
            <Text style={styles.locationText}>New York</Text>
          </View>
        </View>

        <Text style={styles.title}>Sunday Morning Loop</Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>DISTANCE</Text>
            <Text style={styles.statValue}>
              8 <Text style={styles.statUnit}>mi</Text>
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>PACE</Text>
            <Text style={styles.statValue}>
              9:00 <Text style={styles.statUnit}>/ mi</Text>
            </Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="calendar" size={16} color="#999" />
          <Text style={styles.detailText}>Sun Apr 20 · 7:00 AM</Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="location-sharp" size={16} color="#999" />
          <Text style={styles.detailText}>Central Park, Bethesda Fountain</Text>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '60%' }]} />
          </View>
          <View style={styles.spotsRow}>
            <Text style={styles.runnersJoined}>3 runners joined</Text>
            <Text style={styles.spotsLeft}>2 spots left</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.creatorInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>T</Text>
            </View>
            <Text style={styles.creatorName}>Thomas</Text>
          </View>
          <View style={styles.joinButton}>
            <Ionicons name="add-circle" size={20} color="white" />
            <Text style={styles.joinButtonText}>Join</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  colorBar: { height: 4 },
  cardContent: { padding: 20 },
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
    backgroundColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
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
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C4562A',
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