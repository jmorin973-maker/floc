import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'

export default function NotificationsScreen({ visible, onClose, userId, onNotificationPress }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (visible && userId) {
      loadNotifications()
    }
  }, [visible, userId])

  async function loadNotifications() {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          id,
          type,
          read,
          created_at,
          run:runs!notifications_run_id_fkey(id, title, type),
          sender:profiles!notifications_sender_id_fkey(id, full_name, avatar_url)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setNotifications(data || [])
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  async function markAsRead(notificationId) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)

      if (error) throw error
      
      // Update local state
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      )
    } catch (error) {
      console.error('Error marking as read:', error)
    }
  }

  async function markAllAsRead() {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false)

      if (error) throw error
      
      // Update local state
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      )
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  async function handleNotificationPress(notification) {
    // Mark as read immediately in UI
    setNotifications(prev =>
      prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
    )
    
    // Then update in database
    await markAsRead(notification.id)
    
    onNotificationPress(notification.run.id)
    onClose()
  }

  function getNotificationText(notification) {
    if (notification.type === 'new_comment') {
      return `${notification.sender?.full_name || 'Someone'} commented on your run "${notification.run?.title}"`
    } else {
      return `${notification.sender?.full_name || 'Someone'} also commented on "${notification.run?.title}"`
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

  function getRunTypeColor(type) {
    const colors = {
      'Easy': '#10B981',
      'Tempo': '#F59E0B',
      'Intervals': '#EF4444',
      'Long Run': '#3B82F6',
      'Hills': '#8B5CF6',
    }
    return colors[type] || '#6B7280'
  }

  function renderNotification({ item: notification }) {
    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          !notification.read && styles.notificationCardUnread
        ]}
        onPress={() => handleNotificationPress(notification)}
        activeOpacity={0.7}
      >
        <View style={styles.notificationHeader}>
          {notification.sender?.avatar_url ? (
            <Image 
              source={{ uri: notification.sender.avatar_url }} 
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {notification.sender?.full_name?.charAt(0) || '?'}
              </Text>
            </View>
          )}
          
          <View style={styles.notificationContent}>
            <Text style={styles.notificationText}>
              {getNotificationText(notification)}
            </Text>
            <View style={styles.notificationMeta}>
              <View 
                style={[
                  styles.runTypeDot, 
                  { backgroundColor: getRunTypeColor(notification.run?.type) }
                ]} 
              />
              <Text style={styles.notificationTime}>
                {formatTimestamp(notification.created_at)}
              </Text>
            </View>
          </View>

          {!notification.read && (
            <View style={styles.unreadDot} />
          )}
        </View>
      </TouchableOpacity>
    )
  }

  const unreadCount = notifications.filter(n => !n.read).length

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
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 ? (
            <TouchableOpacity onPress={markAllAsRead}>
              <Text style={styles.markAllButton}>Mark all read</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 80 }} />
          )}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0F0F0F" />
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>No notifications yet</Text>
            <Text style={styles.emptySubtext}>
              You'll be notified when someone comments on your runs
            </Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            renderItem={renderNotification}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
          />
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
  },
  markAllButton: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F0F0F',
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
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#666',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#AAA',
    textAlign: 'center',
  },
  list: {
    padding: 16,
  },
  notificationCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  notificationCardUnread: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#0F0F0F',
  },
  notificationHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#666',
  },
  notificationContent: {
    flex: 1,
  },
  notificationText: {
    fontSize: 15,
    color: '#0F0F0F',
    lineHeight: 20,
    marginBottom: 6,
  },
  notificationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  runTypeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  notificationTime: {
    fontSize: 13,
    color: '#999',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0F0F0F',
  },
})