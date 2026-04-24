// v4 Create Run. Cream surface, Space Grotesk 32px hero title,
// 5-up type grid, scoreboard distance/pace inputs, InfoRow card for
// date/time/meeting point/route, capacity row with CapacityDots + stepper.
//
// Preserves: Google Places autocomplete (city + meeting point), GPX upload,
// gender restriction (safety feature), date/time pickers, edit mode.

import { useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal,
  Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import DateTimePicker from '@react-native-community/datetimepicker'
import * as DocumentPicker from 'expo-document-picker'
import Constants from 'expo-constants'
import { supabase } from '../lib/supabase'
import { colors, fonts, radii, space, runTypes } from '../lib/theme'
import Button from '../components/ui/Button'
import InputField from '../components/ui/InputField'
import MicroLabel from '../components/ui/MicroLabel'
import CapacityDots from '../components/ui/CapacityDots'

const RUN_TYPES = ['Easy', 'Tempo', 'Intervals', 'Long Run', 'Hills']
const TYPE_KEY = { Easy: 'easy', Tempo: 'tempo', Intervals: 'intervals', 'Long Run': 'long', Hills: 'hills' }

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
  const [spots, setSpots] = useState(6)
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
      const [hh, mm] = editingRun.time.split(':')
      const td = new Date(); td.setHours(parseInt(hh), parseInt(mm))
      setTime(td)
      setSpots(parseInt(editingRun.spots))
      setRouteUrl(editingRun.route_url || '')
      if (editingRun.route_gpx_url) setGpxFile({ name: 'Existing route.gpx', uri: editingRun.route_gpx_url })
      setGenderRestriction(editingRun.gender_restriction || 'all')
    } else if (visible && !editingRun) {
      clearForm()
    }
  }, [visible, editingRun])

  function clearForm() {
    setTitle(''); setDescription(''); setCity(''); setMeetingPoint('')
    setMeetingPointLat(null); setMeetingPointLng(null)
    setDistance(''); setPace(''); setType('Easy')
    setDate(new Date()); setTime(new Date())
    setSpots(6); setRouteUrl(''); setGpxFile(null); setGenderRestriction('all')
  }

  async function searchCity(q) {
    if (q.length < 2) { setCitySuggestions([]); return }
    try {
      const r = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&types=(cities)&key=${googlePlacesApiKey}`)
      const data = await r.json()
      if (data.predictions) { setCitySuggestions(data.predictions); setShowCitySuggestions(true) }
    } catch (e) { console.error('city search:', e) }
  }

  async function searchMeetingPoint(q) {
    if (q.length < 3) { setMeetingPointSuggestions([]); return }
    try {
      const bias = city ? `${q}, ${city}` : q
      const r = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(bias)}&key=${googlePlacesApiKey}`)
      const data = await r.json()
      if (data.predictions) { setMeetingPointSuggestions(data.predictions); setShowMeetingPointSuggestions(true) }
    } catch (e) { console.error('mp search:', e) }
  }

  function selectCity(p) { setCity(p.description); setShowCitySuggestions(false); setCitySuggestions([]) }

  async function selectMeetingPoint(p) {
    setMeetingPoint(p.description)
    setShowMeetingPointSuggestions(false); setMeetingPointSuggestions([])
    try {
      const r = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.place_id}&fields=geometry&key=${googlePlacesApiKey}`)
      const data = await r.json()
      if (data.result?.geometry?.location) {
        setMeetingPointLat(data.result.geometry.location.lat)
        setMeetingPointLng(data.result.geometry.location.lng)
      }
    } catch (e) { console.error('mp details:', e) }
  }

  async function pickGpxFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/gpx+xml', 'application/xml', 'text/xml', '*/*'],
        copyToCacheDirectory: true,
      })
      if (!result.canceled && result.assets?.[0]) {
        const file = result.assets[0]
        if (!file.name.toLowerCase().endsWith('.gpx')) {
          Alert.alert('Invalid File', 'Please select a .gpx file'); return
        }
        setGpxFile(file)
      }
    } catch (e) { console.error('gpx pick:', e); Alert.alert('Error', 'Could not pick file') }
  }

  async function uploadGpxFile(userId) {
    if (!gpxFile || gpxFile.uri.startsWith('http')) return editingRun?.route_gpx_url || null
    setUploadingGpx(true)
    try {
      const ts = Date.now(); const fileName = `${userId}/route-${ts}.gpx`
      const r = await fetch(gpxFile.uri); const blob = await r.blob()
      const buf = await new Promise((res, rej) => {
        const fr = new FileReader(); fr.onloadend = () => res(fr.result); fr.onerror = rej; fr.readAsArrayBuffer(blob)
      })
      const { error: upErr } = await supabase.storage.from('routes').upload(fileName, buf, {
        contentType: 'application/gpx+xml', upsert: false,
      })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('routes').getPublicUrl(fileName)
      return data.publicUrl
    } catch (e) { console.error('gpx upload:', e); Alert.alert('Error', 'Could not upload route file'); return null }
    finally { setUploadingGpx(false) }
  }

  async function handleCreate() {
    if (!title.trim()) { Alert.alert('Missing Title', 'Please enter a title for your run'); return }
    if (!city) { Alert.alert('City Not Selected', 'Please select a city from the dropdown suggestions'); return }
    if (!meetingPoint.trim()) { Alert.alert('Meeting Point Not Selected', 'Please select a meeting point from the dropdown suggestions'); return }
    if (!distance) { Alert.alert('Missing Distance', 'Please enter a distance in miles'); return }
    if (!pace.trim()) { Alert.alert('Missing Pace', 'Please enter your planned pace (e.g., 8:00)'); return }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const gpxUrl = await uploadGpxFile(user.id)
      const runData = {
        creator_id: user.id,
        title: title.trim(), description: description.trim(),
        city, meeting_point: meetingPoint.trim(),
        lat: meetingPointLat, lng: meetingPointLng,
        distance: parseFloat(distance), pace: pace.trim(), type,
        date: formatDateForDB(date), time: formatTimeForDB(time),
        spots: parseInt(spots),
        route_url: routeUrl.trim() || null, route_gpx_url: gpxUrl,
        gender_restriction: genderRestriction,
      }
      if (editingRun) {
        const { error } = await supabase.from('runs').update(runData).eq('id', editingRun.id)
        if (error) throw error
        Alert.alert('Saved', 'Run updated.')
      } else {
        const { error } = await supabase.from('runs').insert([runData])
        if (error) throw error
        Alert.alert('Posted', 'Your run is live.')
      }
      clearForm(); onRunCreated(); onClose()
    } catch (error) {
      Alert.alert('Error', error.message)
    } finally { setLoading(false) }
  }

  function formatDateForDB(d) { return d.toISOString().split('T')[0] }
  function formatTimeForDB(t) {
    const h = t.getHours().toString().padStart(2, '0')
    const m = t.getMinutes().toString().padStart(2, '0')
    return `${h}:${m}`
  }

  function clampSpots(n) { return Math.max(2, Math.min(20, n)) }

  const typeColor = runTypes[TYPE_KEY[type]]?.color || colors.clay

  function closeAllPickers() {
    setShowCitySuggestions(false)
    setShowMeetingPointSuggestions(false)
    setShowTimePicker(false); setShowDatePicker(false)
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.container}>
          {/* Top bar */}
          <View style={styles.topBar}>
            <Pressable onPress={onClose} style={styles.closeBox}>
              <Ionicons name="close" size={16} color={colors.ink} />
            </Pressable>
            <MicroLabel color={colors.smoke}>{editingRun ? 'EDIT RUN' : 'NEW RUN'}</MicroLabel>
            <Text style={styles.draftLabel}>{loading || uploadingGpx ? 'SAVING' : 'DRAFT'}</Text>
          </View>

          {/* Hero */}
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>
              {editingRun ? 'Edit run.\n' : 'Post a run.\n'}
              <Text style={styles.heroMuted}>{editingRun ? 'Keep it sharp.' : 'Gather a flock.'}</Text>
            </Text>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={{ paddingBottom: 140 }}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={closeAllPickers}
          >
            {/* Title */}
            <InputField
              label="TITLE"
              value={title}
              onChangeText={setTitle}
              placeholder="Brooklyn Bridge Tempo"
              autoCapitalize="words"
              style={{ marginBottom: space.md }}
              onFocus={closeAllPickers}
            />

            {/* Type grid */}
            <MicroLabel size="sm" color={colors.smoke} style={styles.fieldLabel}>TYPE</MicroLabel>
            <View style={styles.typeGrid}>
              {RUN_TYPES.map((t) => {
                const meta = runTypes[TYPE_KEY[t]]
                const on = type === t
                return (
                  <Pressable
                    key={t}
                    onPress={() => setType(t)}
                    style={[
                      styles.typeCell,
                      on && { backgroundColor: meta.soft, borderColor: meta.color, borderWidth: 1.5 },
                    ]}
                  >
                    <View style={[styles.typeDot, { backgroundColor: meta.color }]} />
                    <Text style={[styles.typeLetter, { color: on ? meta.color : colors.ink }]}>{meta.letter}</Text>
                    <Text style={[styles.typeName, { color: on ? meta.color : colors.smoke }]}>{meta.name}</Text>
                  </Pressable>
                )
              })}
            </View>

            {/* Distance + Pace (scoreboard-style) */}
            <View style={styles.row2}>
              <View style={styles.scoreCell}>
                <MicroLabel size="sm" color={colors.smoke}>DISTANCE</MicroLabel>
                <View style={styles.scoreInputRow}>
                  <TextInput
                    value={distance}
                    onChangeText={setDistance}
                    placeholder="6.2"
                    placeholderTextColor={colors.smoke}
                    keyboardType="decimal-pad"
                    style={styles.scoreInput}
                    onFocus={closeAllPickers}
                    selectionColor={colors.clay}
                  />
                  <Text style={styles.scoreUnit}>MI</Text>
                </View>
              </View>
              <View style={styles.scoreCell}>
                <MicroLabel size="sm" color={colors.smoke}>PACE</MicroLabel>
                <View style={styles.scoreInputRow}>
                  <TextInput
                    value={pace}
                    onChangeText={setPace}
                    placeholder="7:30"
                    placeholderTextColor={colors.smoke}
                    style={styles.scoreInput}
                    onFocus={closeAllPickers}
                    selectionColor={colors.clay}
                  />
                  <Text style={styles.scoreUnit}>/MI</Text>
                </View>
              </View>
            </View>

            {/* City autocomplete */}
            <MicroLabel size="sm" color={colors.smoke} style={styles.fieldLabel}>CITY</MicroLabel>
            <View style={styles.autocompleteWrap}>
              <TextInput
                value={city}
                onChangeText={(t) => { setCity(t); searchCity(t) }}
                placeholder="New York, Brooklyn, San Francisco…"
                placeholderTextColor={colors.smoke}
                style={styles.input}
                onFocus={() => {
                  if (city.length >= 2) searchCity(city)
                  setShowMeetingPointSuggestions(false); setShowTimePicker(false)
                }}
                selectionColor={colors.clay}
              />
              {showCitySuggestions && citySuggestions.length > 0 ? (
                <View style={styles.suggestions}>
                  <FlatList
                    data={citySuggestions}
                    keyExtractor={(it) => it.place_id}
                    scrollEnabled={false}
                    renderItem={({ item }) => (
                      <Pressable onPress={() => selectCity(item)} style={styles.suggestItem}>
                        <Ionicons name="location-outline" size={14} color={colors.smoke} />
                        <Text style={styles.suggestText} numberOfLines={1}>{item.description}</Text>
                      </Pressable>
                    )}
                  />
                </View>
              ) : null}
            </View>

            {/* Meeting point autocomplete */}
            <MicroLabel size="sm" color={colors.smoke} style={styles.fieldLabel}>MEETING POINT</MicroLabel>
            <View style={styles.autocompleteWrap}>
              <TextInput
                value={meetingPoint}
                onChangeText={(t) => { setMeetingPoint(t); searchMeetingPoint(t) }}
                placeholder="Cadman Plaza Park, Brooklyn Bridge…"
                placeholderTextColor={colors.smoke}
                style={styles.input}
                onFocus={() => {
                  if (meetingPoint.length >= 3) searchMeetingPoint(meetingPoint)
                  setShowCitySuggestions(false); setShowTimePicker(false)
                }}
                selectionColor={colors.clay}
              />
              {showMeetingPointSuggestions && meetingPointSuggestions.length > 0 ? (
                <View style={styles.suggestions}>
                  <FlatList
                    data={meetingPointSuggestions}
                    keyExtractor={(it) => it.place_id}
                    scrollEnabled={false}
                    renderItem={({ item }) => (
                      <Pressable onPress={() => selectMeetingPoint(item)} style={styles.suggestItem}>
                        <Ionicons name="location-outline" size={14} color={colors.smoke} />
                        <Text style={styles.suggestText} numberOfLines={1}>{item.description}</Text>
                      </Pressable>
                    )}
                  />
                </View>
              ) : null}
            </View>

            {/* When card */}
            <View style={styles.card}>
              <Pressable
                onPress={() => { setShowDatePicker(true); setShowTimePicker(false); closeAllPickers(); setShowDatePicker(true) }}
                style={[styles.cardRow, styles.cardRowBorder]}
              >
                <Ionicons name="calendar-outline" size={18} color={colors.ink} style={{ width: 22 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardRowLabel}>DATE</Text>
                  <Text style={styles.cardRowValue}>
                    {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.smoke} />
              </Pressable>
              {showDatePicker ? (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="inline"
                  minimumDate={new Date()}
                  onChange={(ev, d) => { setShowDatePicker(false); if (d) setDate(d) }}
                />
              ) : null}

              <Pressable
                onPress={() => { setShowTimePicker(v => !v); setShowDatePicker(false); setShowCitySuggestions(false); setShowMeetingPointSuggestions(false) }}
                style={styles.cardRow}
              >
                <Ionicons name="time-outline" size={18} color={colors.ink} style={{ width: 22 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardRowLabel}>TIME</Text>
                  <Text style={styles.cardRowValue}>
                    {time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.smoke} />
              </Pressable>
              {showTimePicker ? (
                <DateTimePicker
                  value={time}
                  mode="time"
                  display="spinner"
                  onChange={(ev, t) => { if (t) setTime(t) }}
                />
              ) : null}
            </View>

            {/* Capacity */}
            <View style={styles.capCard}>
              <View style={styles.capHead}>
                <MicroLabel size="sm" color={colors.smoke}>CAPACITY</MicroLabel>
                <Text style={styles.capCount}>{spots}</Text>
              </View>
              <CapacityDots joined={1} capacity={spots} color={typeColor} size={12} gap={8} />
              <Text style={styles.capHint}>You're the first dot. Tap to change max runners.</Text>
              <View style={styles.capStepper}>
                <Pressable onPress={() => setSpots(s => clampSpots(s - 1))} style={styles.stepBtn}>
                  <Ionicons name="remove" size={16} color={colors.ink} />
                </Pressable>
                <View style={styles.capTrack}>
                  {[2, 4, 6, 8, 10, 12, 16, 20].map((v) => (
                    <Pressable key={v} onPress={() => setSpots(v)} style={[styles.capTick, spots === v && { backgroundColor: colors.ink }]}>
                      <Text style={[styles.capTickText, spots === v && { color: colors.cream }]}>{v}</Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable onPress={() => setSpots(s => clampSpots(s + 1))} style={styles.stepBtn}>
                  <Ionicons name="add" size={16} color={colors.ink} />
                </Pressable>
              </View>
            </View>

            {/* Gender restriction — safety */}
            {userGender && userGender !== 'prefer_not_to_say' ? (
              <>
                <MicroLabel size="sm" color={colors.smoke} style={styles.fieldLabel}>WHO CAN JOIN</MicroLabel>
                <View style={styles.row2}>
                  <Pill
                    label="EVERYONE"
                    active={genderRestriction === 'all'}
                    onPress={() => setGenderRestriction('all')}
                  />
                  {userGender === 'woman' ? (
                    <Pill label="WOMEN ONLY" active={genderRestriction === 'women_only'} onPress={() => setGenderRestriction('women_only')} />
                  ) : userGender === 'man' ? (
                    <Pill label="MEN ONLY" active={genderRestriction === 'men_only'} onPress={() => setGenderRestriction('men_only')} />
                  ) : userGender === 'non_binary' ? (
                    <Pill label="NON-BINARY ONLY" active={genderRestriction === 'non_binary_only'} onPress={() => setGenderRestriction('non_binary_only')} />
                  ) : null}
                </View>
              </>
            ) : null}

            {/* Description */}
            <InputField
              label="NOTES"
              value={description}
              onChangeText={setDescription}
              placeholder="Loop through Prospect Park, stops for water"
              autoCapitalize="sentences"
              style={{ marginTop: space.md }}
              inputStyle={{ paddingTop: 10, minHeight: 80 }}
              multiline
              numberOfLines={3}
              onFocus={closeAllPickers}
            />

            {/* Route — optional */}
            <MicroLabel size="sm" color={colors.smoke} style={styles.fieldLabel}>ROUTE (OPTIONAL)</MicroLabel>
            <TextInput
              value={routeUrl}
              onChangeText={setRouteUrl}
              placeholder="https://strava.com/routes/…"
              placeholderTextColor={colors.smoke}
              keyboardType="url"
              autoCapitalize="none"
              style={styles.input}
              onFocus={closeAllPickers}
              selectionColor={colors.clay}
            />
            <Pressable onPress={pickGpxFile} disabled={uploadingGpx} style={styles.fileBtn}>
              <Ionicons name="document-attach-outline" size={16} color={colors.ink} />
              <Text style={styles.fileBtnText} numberOfLines={1}>
                {gpxFile ? gpxFile.name : 'Attach .gpx file'}
              </Text>
              {uploadingGpx ? <ActivityIndicator size="small" color={colors.clay} /> : null}
            </Pressable>
            {gpxFile ? (
              <Pressable onPress={() => setGpxFile(null)} style={{ marginTop: 6 }}>
                <Text style={styles.removeText}>REMOVE</Text>
              </Pressable>
            ) : null}
          </ScrollView>

          {/* Footer CTA */}
          <View style={styles.footer}>
            <Button
              onPress={handleCreate}
              loading={loading || uploadingGpx}
              iconRight={<Ionicons name="arrow-forward" size={14} color={colors.cream} />}
            >
              {editingRun ? 'Save Run' : 'Post this run'}
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function Pill({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.pill, active && styles.pillActive]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  )
}

// --- styles --------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },

  topBar: {
    paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  closeBox: {
    width: 34, height: 34, borderRadius: radii.chip,
    borderWidth: 1, borderColor: colors.lineStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  draftLabel: {
    fontFamily: fonts.displayBold, fontSize: 11,
    letterSpacing: 1.4, color: colors.smoke, textAlign: 'right',
  },

  hero: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm },
  heroTitle: {
    fontFamily: fonts.displayBold, fontSize: 32, lineHeight: 32 * 1.1,
    letterSpacing: -1.4, color: colors.ink, textTransform: 'uppercase',
  },
  heroMuted: { color: colors.smoke },

  content: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.sm },

  fieldLabel: { marginBottom: 8, marginTop: space.md },

  // Plain input (for city + meeting point + route url)
  input: {
    backgroundColor: colors.paper, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: space.md, paddingVertical: 12,
    fontFamily: fonts.body, fontSize: 15, color: colors.ink,
    minHeight: 50,
  },

  // Type grid
  typeGrid: { flexDirection: 'row', gap: 5 },
  typeCell: {
    flex: 1,
    paddingVertical: 10, paddingHorizontal: 4,
    backgroundColor: colors.paper,
    borderRadius: radii.chip, borderWidth: 1, borderColor: colors.line,
    alignItems: 'center', gap: 6,
  },
  typeDot: { width: 14, height: 14, borderRadius: 999 },
  typeLetter: {
    fontFamily: fonts.displayBold, fontSize: 12, letterSpacing: 0.4,
  },
  typeName: {
    fontFamily: fonts.displayBold, fontSize: 8, letterSpacing: 1,
  },

  // Scoreboard-style distance + pace
  row2: { flexDirection: 'row', gap: 10, marginTop: space.md },
  scoreCell: {
    flex: 1, padding: space.md,
    backgroundColor: colors.paper, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.line,
  },
  scoreInputRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 6 },
  scoreInput: {
    flex: 1,
    fontFamily: fonts.displayBold, fontSize: 32, lineHeight: 34,
    letterSpacing: -1.2, color: colors.ink, padding: 0,
  },
  scoreUnit: {
    fontFamily: fonts.displayBold, fontSize: 11,
    letterSpacing: 1.2, color: colors.smoke,
  },

  // Autocomplete
  autocompleteWrap: { position: 'relative', zIndex: 10 },
  suggestions: {
    position: 'absolute', top: 54, left: 0, right: 0,
    backgroundColor: colors.paper,
    borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radii.card,
    maxHeight: 200, overflow: 'hidden', zIndex: 1000,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 10, elevation: 5,
  },
  suggestItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: space.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  suggestText: {
    fontFamily: fonts.body, fontSize: 13, color: colors.ink, flex: 1,
  },

  // When card
  card: {
    marginTop: space.md,
    backgroundColor: colors.paper, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.line, overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  cardRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  cardRowLabel: {
    fontFamily: fonts.displayBold, fontSize: 9,
    letterSpacing: 1.4, color: colors.smoke,
  },
  cardRowValue: {
    fontFamily: fonts.bodySemibold, fontSize: 14,
    color: colors.ink, marginTop: 2,
  },

  // Capacity
  capCard: {
    marginTop: space.md, padding: space.md,
    backgroundColor: colors.paper, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.line,
  },
  capHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  capCount: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.ink, letterSpacing: -0.3 },
  capHint: { fontFamily: fonts.body, fontSize: 12, color: colors.smoke, marginTop: 10 },
  capStepper: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  stepBtn: {
    width: 32, height: 32, borderRadius: radii.chip,
    borderWidth: 1, borderColor: colors.lineStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  capTrack: { flex: 1, flexDirection: 'row', gap: 4 },
  capTick: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: radii.chip,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.chalk,
  },
  capTickText: {
    fontFamily: fonts.displayBold, fontSize: 10, letterSpacing: 0.4, color: colors.ink,
  },

  // Pills
  pill: {
    flex: 1,
    paddingHorizontal: 12, paddingVertical: 12,
    borderRadius: radii.chip, borderWidth: 1, borderColor: colors.lineStrong,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.transparent,
  },
  pillActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  pillText: {
    fontFamily: fonts.displayBold, fontSize: 10,
    letterSpacing: 1.4, color: colors.ink,
  },
  pillTextActive: { color: colors.cream },

  // File
  fileBtn: {
    marginTop: space.xs,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: space.md, paddingVertical: 12,
    backgroundColor: colors.paper, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.line,
  },
  fileBtnText: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  removeText: {
    fontFamily: fonts.displayBold, fontSize: 10,
    letterSpacing: 1.4, color: colors.clay,
  },

  // Footer
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: 28,
    backgroundColor: colors.cream,
    borderTopWidth: 1, borderTopColor: colors.line,
  },
})
