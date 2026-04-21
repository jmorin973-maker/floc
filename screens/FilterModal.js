import { useEffect, useState } from 'react'
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'

const RUN_TYPES = ['Easy', 'Tempo', 'Intervals', 'Long Run', 'Hills']

export default function FilterModal({ visible, onClose, onApply, currentFilters, allRuns }) {
  const [minDistance, setMinDistance] = useState('')
  const [maxDistance, setMaxDistance] = useState('')
  const [minPace, setMinPace] = useState('')
  const [maxPace, setMaxPace] = useState('')
  const [selectedTypes, setSelectedTypes] = useState([])
  const [selectedCities, setSelectedCities] = useState([])

  const cities = [...new Set(allRuns.map(run => run.city).filter(Boolean))]

  useEffect(() => {
    if (visible) {
      setMinDistance(currentFilters.minDistance?.toString() || '')
      setMaxDistance(currentFilters.maxDistance?.toString() || '')
      setMinPace(currentFilters.minPace || '')
      setMaxPace(currentFilters.maxPace || '')
      setSelectedTypes(currentFilters.types || [])
      setSelectedCities(currentFilters.cities || [])
    }
  }, [visible, currentFilters])

  function handleApply() {
    onApply({
      minDistance: minDistance ? parseFloat(minDistance) : null,
      maxDistance: maxDistance ? parseFloat(maxDistance) : null,
      minPace: minPace || null,
      maxPace: maxPace || null,
      types: selectedTypes,
      cities: selectedCities,
    })
    onClose()
  }

  function handleClear() {
    setMinDistance('')
    setMaxDistance('')
    setMinPace('')
    setMaxPace('')
    setSelectedTypes([])
    setSelectedCities([])
    onApply({
      minDistance: null,
      maxDistance: null,
      minPace: null,
      maxPace: null,
      types: [],
      cities: [],
    })
  }

  function toggleType(type) {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  function toggleCity(city) {
    setSelectedCities(prev =>
      prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
    )
  }

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
            <Text style={styles.closeButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Filters</Text>
          <TouchableOpacity onPress={handleClear}>
            <Text style={styles.clearButton}>Clear</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>Distance (miles)</Text>
          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Min</Text>
              <TextInput
                style={styles.input}
                value={minDistance}
                onChangeText={setMinDistance}
                placeholder="0"
                placeholderTextColor="#AAA"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Max</Text>
              <TextInput
                style={styles.input}
                value={maxDistance}
                onChangeText={setMaxDistance}
                placeholder="26.2"
                placeholderTextColor="#AAA"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <Text style={styles.sectionTitle}>Pace (per mile)</Text>
          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Min (slower)</Text>
              <TextInput
                style={styles.input}
                value={minPace}
                onChangeText={setMinPace}
                placeholder="10:00"
                placeholderTextColor="#AAA"
              />
            </View>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Max (faster)</Text>
              <TextInput
                style={styles.input}
                value={maxPace}
                onChangeText={setMaxPace}
                placeholder="6:00"
                placeholderTextColor="#AAA"
              />
            </View>
          </View>

          <Text style={styles.sectionTitle}>Run Type</Text>
          <View style={styles.typeButtons}>
            {RUN_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeButton,
                  selectedTypes.includes(type) && styles.typeButtonActive,
                ]}
                onPress={() => toggleType(type)}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    selectedTypes.includes(type) && styles.typeButtonTextActive,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {cities.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>City</Text>
              <View style={styles.cityButtons}>
                {cities.map((city) => (
                  <TouchableOpacity
                    key={city}
                    style={[
                      styles.cityButton,
                      selectedCities.includes(city) && styles.cityButtonActive,
                    ]}
                    onPress={() => toggleCity(city)}
                  >
                    <Text
                      style={[
                        styles.cityButtonText,
                        selectedCities.includes(city) && styles.cityButtonTextActive,
                      ]}
                    >
                      {city}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
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
  closeButton: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  clearButton: {
    fontSize: 16,
    color: '#DC2626',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F0F0F',
    marginBottom: 12,
    marginTop: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
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
  cityButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cityButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  cityButtonActive: {
    backgroundColor: '#0F0F0F',
    borderColor: '#0F0F0F',
  },
  cityButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  cityButtonTextActive: {
    color: 'white',
  },
  footer: {
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  applyButton: {
    backgroundColor: '#0F0F0F',
    padding: 16,
    borderRadius: 12,
  },
  applyButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
})