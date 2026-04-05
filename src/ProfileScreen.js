import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILES = [
  { id: 'dad', name: '아빠', emoji: '🧔' },
  { id: 'mom', name: '엄마', emoji: '👩' },
  { id: 'hayeon', name: '하연이', emoji: '👧' },
];

export default function ProfileScreen({ onSelect }) {
  const selectProfile = async (profile) => {
    await AsyncStorage.setItem('fambee_profile', JSON.stringify(profile));
    onSelect(profile);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🐝</Text>
      <Text style={styles.title}>FamBee</Text>
      <Text style={styles.sub}>누구야~?</Text>
      <View style={styles.profiles}>
        {PROFILES.map(p => (
          <TouchableOpacity key={p.id} style={styles.card} onPress={() => selectProfile(p)}>
            <Text style={styles.emoji}>{p.emoji}</Text>
            <Text style={styles.name}>{p.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFC107', justifyContent: 'center', alignItems: 'center' },
  logo: { fontSize: 80 },
  title: { fontSize: 36, fontWeight: 'bold', color: '#333', marginTop: 8 },
  sub: { fontSize: 18, color: '#666', marginTop: 4, marginBottom: 32 },
  profiles: { flexDirection: 'row', gap: 16 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', width: 100, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  emoji: { fontSize: 40 },
  name: { fontSize: 16, fontWeight: '600', color: '#333', marginTop: 8 },
});
