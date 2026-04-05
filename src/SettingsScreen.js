import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform, Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import Popup from './Popup';

const BG_OPTIONS = [
  { name: '기본 (밝은 노랑)', color: '#FFF8E1' },
  { name: '하늘', color: '#E3F2FD' },
  { name: '연핑크', color: '#FCE4EC' },
  { name: '연초록', color: '#E8F5E9' },
  { name: '연보라', color: '#F3E5F5' },
  { name: '아이보리', color: '#FFFDE7' },
  { name: '화이트', color: '#FFFFFF' },
  { name: '다크', color: '#303030' },
];

export default function SettingsScreen({ profile, onLogout, chatBg, onChangeBg }) {
  const insets = useSafeAreaInsets();
  const [showLogout, setShowLogout] = useState(false);
  const [showBgPicker, setShowBgPicker] = useState(false);

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
        <TouchableOpacity style={styles.menuItem} onPress={() => {
          if (Platform.OS === 'android') {
            Linking.openSettings();
          }
        }}>
          <Text style={styles.menuLabel}>알림 설정</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => setShowBgPicker(true)}>
          <Text style={styles.menuLabel}>채팅방 배경</Text>
          <View style={[styles.bgPreview, { backgroundColor: chatBg || '#FFF8E1' }]} />
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

      <Modal visible={showBgPicker} transparent animationType="fade">
        <View style={styles.bgModalOverlay}>
          <View style={styles.bgModal}>
            <Text style={styles.bgModalTitle}>채팅방 배경 선택</Text>
            <View style={styles.bgGrid}>
              {BG_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.color}
                  style={styles.bgGridItem}
                  onPress={() => { onChangeBg(opt.color); setShowBgPicker(false); }}
                >
                  <View style={[styles.bgColorCircle, { backgroundColor: opt.color }, chatBg === opt.color && styles.bgColorSelected]} />
                  <Text style={styles.bgGridName}>{opt.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.bgCloseBtn} onPress={() => setShowBgPicker(false)}>
              <Text style={styles.bgCloseBtnText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  bgPreview: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', marginRight: 8 },
  version: { textAlign: 'center', color: '#bbb', fontSize: 12, marginTop: 30 },

  bgModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  bgModal: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '80%' },
  bgModalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 20, textAlign: 'center' },
  bgGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  bgGridItem: { width: '25%', alignItems: 'center', marginBottom: 16 },
  bgColorCircle: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: '#ddd' },
  bgColorSelected: { borderWidth: 3, borderColor: '#FFA000' },
  bgGridName: { fontSize: 11, color: '#666', marginTop: 6, textAlign: 'center' },
  bgCloseBtn: { marginTop: 8, paddingVertical: 12, backgroundColor: '#f5f5f5', borderRadius: 10, alignItems: 'center' },
  bgCloseBtnText: { fontSize: 16, color: '#666' },
});
