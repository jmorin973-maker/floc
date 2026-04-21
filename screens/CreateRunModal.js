import { useEffect, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import DateTimePicker from '@react-native-community/datetimepicker'
import * as DocumentPicker from 'expo-document-picker'
import Constants from 'expo-constants'
import { supabase } from '../lib/supabase'

const RUN_TYPES = ['Easy', 'Tempo', 'Intervals', 'Long Run', 'Hills']

export default function CreateRunModal({ visible, onClose, onRunCreated, editingRun, userGender }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [city, setCity] = useState('')
  const [citySuggestions, setCitySuggestions] = useState([])
  const [showCitySuggestions, setShowCitySuggestions] = useState(false)
  const [meetingPoint, setMeetingPoint] = useState('')
  const [meetingPointSuggestions, setMeetingPointSuggestions] = useState([])
  const [showMeetingPointSuggestions, setShowMeetingPointSuggestions] = useState(false)
  const [meetingPointLat, setMeetingPointLat] = useState(null)
  const [meetingPointLng, setMeetingPointLng] = useState(null)
  const [distance, setDistance] = useState('')
  const [pace, setPace] = useState('')
  const [type, setType] = useState('Easy')
  const [date, setDate] = useState(new Date())
  const [time, setTime] = useState(new Date())
  const [spots, setSpots] = useState('10')
  const [routeUrl, setRouteUrl] = useState('')
  const [gpxFile, setGpxFile] = useState(null)
  const [uploadingGpx, setUploadingGpx] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [genderRestriction, setGenderRestriction] = useState('all')

  const googlePlacesApiKey = Constants.expoConfig?.extra?.googlePlacesApiKey

  useEffect(() => {
    if (visible && editingRun) {
      setTitle(editingRun.title)
      setDescription(editingRun.description || '')
      setCity(editingRun.city)
      setMeetingPoint(editingRun.meeting_point)
      setMeetingPointLat(editingRun.lat)
      setMeetingPointLng(editingRun.lng)
      setDistance(editingRun.distance.toString())
      setPace(editingRun.pace)
      setType(editingRun.type)
      setDate(new Date(editingRun.date))
      const [hours, minutes] = editingRun.time.split(':')
      const timeDate = new Date()
      timeDate.setHours(parseInt(hours), parseInt(minutes))
      setTime(timeDate)
      setSpots(editingRun.spots.toString())
      setRouteUrl(editingRun.route_url || '')
      if (editingRun.route_gpx_url) {
        setGpxFile({ name: 'Existing route.gpx', uri: editingRun.route_gpx_url })
      }
      setGenderRestriction(editingRun.gender_restriction || 'all')
    } else if (visible && !editingRun) {
      clearForm()
    }
  }, [visible, editingRun])

  function clearForm() {
    setTitle('')
    setDescription('')
    setCity('')
    setMeetingPoint('')
    setMeetingPointLat(null)
    setMeetingPointLng(null)
    setDistance('')
    setPace('')
    setType('Easy')
    setDate(new Date())
    setTime(new Date())
    setSpots('10')
    setRouteUrl('')
    setGpxFile(null)
    setGenderRestriction('all')
  }

  async function searchCity(query) {
    if (query.length < 2) {
      setCitySuggestions([])
      return
    }

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
          query
        )}&types=(cities)&key=${googlePlacesApiKey}`
      )
      const data = await response.json()

      if (data.predictions) {
        setCitySuggestions(data.predictions)
        setShowCitySuggestions(true)
      }
    } catch (error) {
      console.error('Error searching city:', error)
    }
  }

  async function searchMeetingPoint(query) {
    if (query.length < 3) {
      setMeetingPointSuggestions([])
      return
    }

    try {
      const biasQuery = city ? `${query}, ${city}` : query
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
          biasQuery
        )}&key=${googlePlacesApiKey}`
      )
      const data = await response.json()

      if (data.predictions) {
        setMeetingPointSuggestions(data.predictions)
        setShowMeetingPointSuggestions(true)
      }
    } catch (error) {
      console.error('Error searching meeting point:', error)
    }
  }

  async function selectCity(prediction) {
    setCity(prediction.description)
    setShowCitySuggestions(false)
    setCitySuggestions([])
  }

  async function selectMeetingPoint(prediction) {
    setMeetingPoint(prediction.description)
    setShowMeetingPointSuggestions(false)
    setMeetingPointSuggestions([])

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=geometry&key=${googlePlacesApiKey}`
      )
      const data = await response.json()

      if (data.result?.geometry?.location) {
        setMeetingPointLat(data.result.geometry.location.lat)
        setMeetingPointLng(data.result.geometry.location.lng)
      }
    } catch (error) {
      console.error('Error getting place details:', error)
    }
  }

  async function pickGpxFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/gpx+xml', 'application/xml', 'text/xml', '*/*'],
        copyToCacheDirectory: true,
      })

      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0]
        
        // Validate file extension
        if (!file.name.toLowerCase().endsWith('.gpx')) {
          Alert.alert('Invalid File', 'Please select a .gpx file')
          return
        }

        setGpxFile(file)
      }
    } catch (error) {
      console.error('Error picking GPX file:', error)
      Alert.alert('Error', 'Could not pick file')
    }
  }

  async function uploadGpxFile(userId) {
    if (!gpxFile || gpxFile.uri.startsWith('http')) {
      // No new file to upload, or file is already uploaded
      return editingRun?.route_gpx_url || null
    }

    setUploadingGpx(true)

    try {
      const fileExt = 'gpx'
      const timestamp = new Date().getTime()
      const fileName = `${userId}/route-${timestamp}.${fileExt}`

      // Read file content properly for React Native
      const response = await fetch(gpxFile.uri)
      const fileBlob = await response.blob()
      
      // Convert blob to ArrayBuffer for Supabase
      const arrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsArrayBuffer(fileBlob)
      })

      const { error: uploadError } = await supabase.storage
        .from('routes')
        .upload(fileName, arrayBuffer, {
          contentType: 'application/gpx+xml',
          upsert: false
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        throw uploadError
      }

      const { data } = supabase.storage
        .from('routes')
        .getPublicUrl(fileName)

      return data.publicUrl
    } catch (error) {
      console.error('Error uploading GPX:', error)
      Alert.alert('Error', 'Could not upload route file')
      return null
    } finally {
      setUploadingGpx(false)
    }
  }

  async function handleCreate() {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a title for your run')
      return
    }
    
    if (!city) {
      Alert.alert('City Not Selected', 'Please select a city from the dropdown suggestions')
      return
    }
    
    if (!meetingPoint.trim()) {
      Alert.alert('Meeting Point Not Selected', 'Please select a meeting point from the dropdown suggestions')
      return
    }
    
    if (!distance) {
      Alert.alert('Missing Distance', 'Please enter a distance in miles')
      return
    }
    
    if (!pace.trim()) {
      Alert.alert('Missing Pace', 'Please enter your planned pace (e.g., 8:00)')
      return
    }

    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Upload GPX file if selected
      const gpxUrl = await uploadGpxFile(user.id)

      const runData = {
        creator_id: user.id,
        title: title.trim(),
        description: description.trim(),
        city: city,
        meeting_point: meetingPoint.trim(),
        lat: meetingPointLat,
        lng: meetingPointLng,
        distance: parseFloat(distance),
        pace: pace.trim(),
        type,
        date: formatDateForDB(date),
        time: formatTimeForDB(time),
        spots: parseInt(spots),
        route_url: routeUrl.trim() || null,
        route_gpx_url: gpxUrl,
        gender_restriction: genderRestriction,
      }

      if (editingRun) {
        const { error } = await supabase
          .from('runs')
          .update(runData)
          .eq('id', editingRun.id)

        if (error) throw error
        Alert.alert('Success', 'Run updated!')
      } else {
        const { error } = await supabase
          .from('runs')
          .insert([runData])

        if (error) throw error
        Alert.alert('Success', 'Run created!')
      }

      clearForm()
      onRunCreated()
      onClose()
    } catch (error) {
      Alert.alert('Error', error.message)
    } finally {
      setLoading(false)
    }
  }

  function formatDateForDB(date) {
    return date.toISOString().split('T')[0]
  }

  function formatTimeForDB(time) {
    const hours = time.getHours().toString().padStart(2, '0')
    const minutes = time.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }

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
              <Text style={styles.closeButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {editingRun ? 'Edit Run' : 'Create Run'}
            </Text>
            <TouchableOpacity onPress={handleCreate} disabled={loading || uploadingGpx}>
              <Text style={[styles.createButton, (loading || uploadingGpx) && styles.createButtonDisabled]}>
                {loading || uploadingGpx ? 'Saving...' : editingRun ? 'Save' : 'Create'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.content}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={() => {
            setShowCitySuggestions(false)
            setShowMeetingPointSuggestions(false)
              }}
          >
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Brooklyn Bridge Tempo"
              placeholderTextColor="#AAA"
              onFocus={() => {
                setShowCitySuggestions(false)
                setShowMeetingPointSuggestions(false)
                setShowTimePicker(false)
              }}
            />

            <Text style={styles.label}>Description (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Cross the bridge, loop through Manhattan"
              placeholderTextColor="#AAA"
              multiline
              numberOfLines={3}
              onFocus={() => {
                setShowCitySuggestions(false)
                setShowMeetingPointSuggestions(false)
                setShowTimePicker(false)
              }}
            />

            <Text style={styles.label}>City</Text>
            <View style={styles.autocompleteContainer}>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={(text) => {
                  setCity(text)
                  searchCity(text)
                }}
                placeholder="New York, Brooklyn, San Francisco..."
                placeholderTextColor="#AAA"
                onFocus={() => {
                  if (city.length >= 2) {
                    searchCity(city)
                  }
                  setShowMeetingPointSuggestions(false)
                  setShowTimePicker(false)
                }}
              />
              {showCitySuggestions && citySuggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  <FlatList
                    data={citySuggestions}
                    keyExtractor={(item) => item.place_id}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.suggestionItem}
                        onPress={() => selectCity(item)}
                      >
                        <Ionicons name="location" size={16} color="#999" />
                        <Text style={styles.suggestionText}>{item.description}</Text>
                      </TouchableOpacity>
                    )}
                    scrollEnabled={false}
                  />
                </View>
              )}
            </View>

            <Text style={styles.label}>Meeting Point</Text>
            <View style={styles.autocompleteContainer}>
              <TextInput
                style={styles.input}
                value={meetingPoint}
                onChangeText={(text) => {
                  setMeetingPoint(text)
                  searchMeetingPoint(text)
                }}
                placeholder="Cadman Plaza Park, Brooklyn Bridge..."
                placeholderTextColor="#AAA"
                onFocus={() => {
                  if (meetingPoint.length >= 3) {
                    searchMeetingPoint(meetingPoint)
                  }
                  setShowCitySuggestions(false)
                  setShowTimePicker(false)
                }}
              />
              {showMeetingPointSuggestions && meetingPointSuggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  <FlatList
                    data={meetingPointSuggestions}
                    keyExtractor={(item) => item.place_id}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.suggestionItem}
                        onPress={() => selectMeetingPoint(item)}
                      >
                        <Ionicons name="location" size={16} color="#999" />
                        <Text style={styles.suggestionText}>{item.description}</Text>
                      </TouchableOpacity>
                    )}
                    scrollEnabled={false}
                  />
                </View>
              )}
            </View>

            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Text style={styles.label}>Distance (mi)</Text>
                <TextInput
                  style={styles.input}
                  value={distance}
                  onChangeText={setDistance}
                  placeholder="8.5"
                  placeholderTextColor="#AAA"
                  keyboardType="decimal-pad"
                  onFocus={() => {
                    setShowCitySuggestions(false)
                    setShowMeetingPointSuggestions(false)
                    setShowTimePicker(false)
                  }}
                />
              </View>
              <View style={styles.halfWidth}>
                <Text style={styles.label}>Pace (/mi)</Text>
                <TextInput
                  style={styles.input}
                  value={pace}
                  onChangeText={setPace}
                  placeholder="7:30"
                  placeholderTextColor="#AAA"
                  onFocus={() => {
                    setShowCitySuggestions(false)
                    setShowMeetingPointSuggestions(false)
                    setShowTimePicker(false)
                  }}
                />
              </View>
            </View>

            <Text style={styles.label}>Run Type</Text>
            <View style={styles.typeButtons}>
              {RUN_TYPES.map((runType) => (
                <TouchableOpacity
                  key={runType}
                  style={[
                    styles.typeButton,
                    type === runType && styles.typeButtonActive,
                  ]}
                  onPress={() => setType(runType)}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      type === runType && styles.typeButtonTextActive,
                    ]}
                  >
                    {runType}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {userGender && userGender !== 'prefer_not_to_say' && (
              <>
                <Text style={styles.label}>Who can join? (Safety feature)</Text>
                <View style={styles.typeButtons}>
                  <TouchableOpacity
                    style={[
                      styles.typeButton,
                      genderRestriction === 'all' && styles.typeButtonActive
                    ]}
                    onPress={() => setGenderRestriction('all')}
                  >
                    <Text style={[
                      styles.typeButtonText,
                      genderRestriction === 'all' && styles.typeButtonTextActive
                    ]}>
                      Everyone
                    </Text>
                  </TouchableOpacity>

                  {userGender === 'woman' && (
                    <TouchableOpacity
                      style={[
                        styles.typeButton,
                        genderRestriction === 'women_only' && styles.typeButtonActive
                      ]}
                      onPress={() => setGenderRestriction('women_only')}
                    >
                      <Text style={[
                        styles.typeButtonText,
                        genderRestriction === 'women_only' && styles.typeButtonTextActive
                      ]}>
                        Women only
                      </Text>
                    </TouchableOpacity>
                  )}

                  {userGender === 'man' && (
                    <TouchableOpacity
                      style={[
                        styles.typeButton,
                        genderRestriction === 'men_only' && styles.typeButtonActive
                      ]}
                      onPress={() => setGenderRestriction('men_only')}
                    >
                      <Text style={[
                        styles.typeButtonText,
                        genderRestriction === 'men_only' && styles.typeButtonTextActive
                      ]}>
                        Men only
                      </Text>
                    </TouchableOpacity>
                  )}

                  {userGender === 'non_binary' && (
                    <TouchableOpacity
                      style={[
                        styles.typeButton,
                        genderRestriction === 'non_binary_only' && styles.typeButtonActive
                      ]}
                      onPress={() => setGenderRestriction('non_binary_only')}
                    >
                      <Text style={[
                        styles.typeButtonText,
                        genderRestriction === 'non_binary_only' && styles.typeButtonTextActive
                      ]}>
                        Non-binary only
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}


            <Text style={styles.label}>Date</Text>
            <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={() => {
                setShowDatePicker(true)
                setShowCitySuggestions(false)
                setShowMeetingPointSuggestions(false)
                setShowTimePicker(false)
              }}
            >
              <Ionicons name="calendar" size={20} color="#666" />
              <Text style={styles.dateTimeText}>
                {date.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display="inline"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false)
                  if (selectedDate) {
                    setDate(selectedDate)
                  }
                }}
                minimumDate={new Date()}
              />
            )}

            <Text style={styles.label}>Time</Text>
            <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={() => {
                setShowTimePicker(!showTimePicker)
                setShowCitySuggestions(false)
                setShowMeetingPointSuggestions(false)
              }}
            >
              <Ionicons name="time" size={20} color="#666" />
              <Text style={styles.dateTimeText}>
                {time.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </TouchableOpacity>

            {showTimePicker && (
              <DateTimePicker
                value={time}
                mode="time"
                display="spinner"
                onChange={(event, selectedTime) => {
                  if (selectedTime) {
                    setTime(selectedTime)
                  }
                }}
              />
            )}

            <Text style={styles.label}>Spots Available</Text>
            <TextInput
              style={styles.input}
              value={spots}
              onChangeText={setSpots}
              placeholder="10"
              placeholderTextColor="#AAA"
              keyboardType="number-pad"
              onFocus={() => {
                setShowCitySuggestions(false)
                setShowMeetingPointSuggestions(false)
                setShowTimePicker(false)
              }}
            />

            <Text style={styles.sectionHeader}>Route (optional)</Text>
            
            <Text style={styles.label}>Route URL</Text>
            <TextInput
              style={styles.input}
              value={routeUrl}
              onChangeText={setRouteUrl}
              placeholder="https://strava.com/routes/..."
              placeholderTextColor="#AAA"
              keyboardType="url"
              autoCapitalize="none"
              onFocus={() => {
                setShowCitySuggestions(false)
                setShowMeetingPointSuggestions(false)
                setShowTimePicker(false)
              }}
            />

            <Text style={styles.label}>GPX File</Text>
            <TouchableOpacity
              style={styles.fileButton}
              onPress={pickGpxFile}
              disabled={uploadingGpx}
            >
              <Ionicons name="document" size={20} color="#666" />
              <Text style={styles.fileButtonText}>
                {gpxFile ? gpxFile.name : 'Upload .gpx file'}
              </Text>
              {uploadingGpx && <ActivityIndicator size="small" color="#666" />}
            </TouchableOpacity>
            {gpxFile && (
              <TouchableOpacity
                style={styles.removeFileButton}
                onPress={() => setGpxFile(null)}
              >
                <Text style={styles.removeFileText}>Remove file</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
  closeButton: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  createButton: {
    fontSize: 16,
    color: '#0F0F0F',
    fontWeight: '700',
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F0F0F',
    marginTop: 24,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F0F0F',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#0F0F0F',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  autocompleteContainer: {
    position: 'relative',
    zIndex: 1,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    zIndex: 1000,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 8,
  },
  suggestionText: {
    fontSize: 14,
    color: '#0F0F0F',
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  typeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  typeButtonActive: {
    backgroundColor: '#0F0F0F',
    borderColor: '#0F0F0F',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  typeButtonTextActive: {
    color: 'white',
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  dateTimeText: {
    fontSize: 16,
    color: '#0F0F0F',
  },
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  fileButtonText: {
    fontSize: 16,
    color: '#0F0F0F',
    flex: 1,
  },
  removeFileButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  removeFileText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '600',
  },
  
})