import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import Popup from './Popup';

export default function SettingsScreen({ profile, onLogout }) {
  const insets = useSafeAreaInsets();

  const [showLogout, setShowLogout] = useState(false);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>설정</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.profileRow}>
          <Text style={styles.profileEmoji}>{profile.emoji}</Text>
          <View>
            <Text style={styles.profileName}>{profile.name}</Text>
            <Text style={styles.profileSub}>현재 접속 중</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuLabel}>알림 설정</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuLabel}>채팅방 배경</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.menuItem} onPress={() => setShowLogout(true)}>
          <Text style={styles.menuLabel}>프로필 변경</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>FamBee v{Constants.expoConfig?.version || '?'}</Text>

      <Popup
        visible={showLogout}
        title="프로필 변경"
        onClose={() => setShowLogout(false)}
        options={[
          { label: '다른 프로필로 전환', onPress: () => { setShowLogout(false); onLogout(); } },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f0e0' },
  header: { backgroundColor: '#FFC107', paddingVertical: 12, paddingHorizontal: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  section: { backgroundColor: '#FFF8E1', marginTop: 10 },
  profileRow: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  profileEmoji: { fontSize: 44, marginRight: 14 },
  profileName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  profileSub: { fontSize: 13, color: '#999', marginTop: 2 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  menuLabel: { flex: 1, fontSize: 16, color: '#333' },
  menuArrow: { fontSize: 20, color: '#ccc' },
  version: { textAlign: 'center', color: '#bbb', fontSize: 12, marginTop: 30 },
});
