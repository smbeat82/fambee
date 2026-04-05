import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, Keyboard, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { FAMILY } from './constants';
import Popup from './Popup';
import CropModal from './CropModal';

export default function FamilyScreen({ profile, navigation }) {
  const insets = useSafeAreaInsets();
  const [profiles, setProfiles] = useState({});
  const [editingStatus, setEditingStatus] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [photoPopup, setPhotoPopup] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [cropImage, setCropImage] = useState(null);
  const [cropMember, setCropMember] = useState(null);

  useEffect(() => {
    let unsub;
    const load = async () => {
      try {
        const { db } = require('./firebase');
        const { collection, onSnapshot } = require('firebase/firestore');
        unsub = onSnapshot(collection(db, 'profiles'), (snapshot) => {
          const data = {};
          snapshot.docs.forEach(d => { data[d.id] = d.data(); });
          setProfiles(data);
        });
      } catch (e) {}
    };
    load();
    return () => { if (unsub) unsub(); };
  }, []);

  const saveStatus = async () => {
    try {
      const { db } = require('./firebase');
      const { doc, setDoc, serverTimestamp } = require('firebase/firestore');
      await setDoc(doc(db, 'profiles', profile.id), {
        ...profiles[profile.id],
        status: statusText.trim(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (e) {}
    setEditingStatus(false);
    Keyboard.dismiss();
  };

  const resetPhoto = async (memberId) => {
    try {
      const { db } = require('./firebase');
      const { doc, setDoc, serverTimestamp, deleteField } = require('firebase/firestore');
      await setDoc(doc(db, 'profiles', memberId), {
        photoUrl: deleteField(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (e) {}
    setPhotoPopup(null);
  };

  const uploadProfilePhoto = async (memberId, uri) => {
    setUploading(true);
    try {
      const { storage } = require('./firebase');
      const { ref, uploadBytes, getDownloadURL } = require('firebase/storage');
      const { db } = require('./firebase');
      const { doc, setDoc, serverTimestamp } = require('firebase/firestore');

      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `profiles/${memberId}.jpg`);
      await uploadBytes(storageRef, blob);
      const photoUrl = await getDownloadURL(storageRef);

      await setDoc(doc(db, 'profiles', memberId), {
        ...profiles[memberId],
        photoUrl,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      Alert.alert('실패', '프로필 사진을 변경하지 못했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const changePhoto = async (memberId) => {
    setPhotoPopup(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled) return;
    setCropMember(memberId);
    setCropImage(result.assets[0].uri);
  };

  const takePhoto = async (memberId) => {
    setPhotoPopup(null);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled) return;
    setCropMember(memberId);
    setCropImage(result.assets[0].uri);
  };

  const handleCrop = async (cropData) => {
    const uri = cropImage;
    setCropImage(null);
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [
          { crop: cropData },
          { resize: { width: 400, height: 400 } },
        ],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      await uploadProfilePhoto(cropMember, result.uri);
    } catch (e) {
      Alert.alert('실패', '이미지 처리 중 오류가 발생했습니다.');
    }
  };

  const startEdit = () => {
    setStatusText(profiles[profile.id]?.status || '');
    setEditingStatus(true);
  };

  const me = FAMILY.find(f => f.id === profile.id);
  const others = FAMILY.filter(f => f.id !== profile.id);
  const myStatus = profiles[profile.id]?.status || '';

  const renderAvatar = (memberId, size) => {
    const member = FAMILY.find(f => f.id === memberId);
    const photoUrl = profiles[memberId]?.photoUrl;
    if (photoUrl) {
      return <Image source={{ uri: photoUrl }} style={{ width: size, height: size, borderRadius: size * 0.3 }} />;
    }
    return (
      <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: '#FFF3D4', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: size * 0.55 }}>{member?.emoji}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>가족</Text>
      </View>

      {/* 내 프로필 */}
      <View style={styles.myProfile}>
        <TouchableOpacity onPress={() => setPhotoPopup(profile.id)} style={styles.myAvatarWrap}>
          {renderAvatar(profile.id, 64)}
          <View style={styles.cameraBadge}>
            <Text style={styles.cameraBadgeText}>+</Text>
          </View>
          {uploading && (
            <View style={styles.uploadOverlay}>
              <Text style={styles.uploadText}>...</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.myInfo} onPress={startEdit}>
          <Text style={styles.myName}>{me?.name}</Text>
          {editingStatus ? (
            <View style={styles.statusEdit}>
              <TextInput
                style={styles.statusInput}
                value={statusText}
                onChangeText={setStatusText}
                placeholder="상태 메시지 입력..."
                placeholderTextColor="#ccc"
                autoFocus
                maxLength={30}
                onSubmitEditing={saveStatus}
              />
              <TouchableOpacity onPress={saveStatus} style={styles.statusSave}>
                <Text style={styles.statusSaveText}>저장</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.myStatus}>{myStatus || '상태 메시지를 입력해보세요'}</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />
      <Text style={styles.sectionTitle}>가족 {others.length}</Text>

      {others.map(member => (
        <TouchableOpacity
          key={member.id}
          style={styles.memberItem}
          onPress={() => {
            const roomId = [profile.id, member.id].sort().join('_');
            navigation.navigate('Chat', { roomId, roomName: member.name, isGroup: false });
          }}
        >
          <View style={styles.memberAvatar}>
            {renderAvatar(member.id, 46)}
          </View>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{member.name}</Text>
            <Text style={styles.memberStatus}>{profiles[member.id]?.status || ''}</Text>
          </View>
        </TouchableOpacity>
      ))}

      <CropModal
        visible={!!cropImage}
        imageUri={cropImage}
        onCrop={handleCrop}
        onClose={() => setCropImage(null)}
      />

      <Popup
        visible={!!photoPopup}
        title="프로필 사진"
        onClose={() => setPhotoPopup(null)}
        options={[
          { label: '갤러리에서 선택', onPress: () => changePhoto(photoPopup) },
          { label: '카메라로 촬영', onPress: () => takePhoto(photoPopup) },
          ...(profiles[photoPopup]?.photoUrl ? [{ label: '기본 이모지로 변경', onPress: () => resetPhoto(photoPopup) }] : []),
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8E1' },
  header: { backgroundColor: '#FFC107', paddingVertical: 12, paddingHorizontal: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  myProfile: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  myAvatarWrap: { position: 'relative', marginRight: 16 },
  cameraBadge: { position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFC107', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF8E1' },
  cameraBadgeText: { fontSize: 14, fontWeight: 'bold', color: '#fff', marginTop: -1 },
  uploadOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  uploadText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  myInfo: { flex: 1 },
  myName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  myStatus: { fontSize: 14, color: '#999', marginTop: 4 },
  statusEdit: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  statusInput: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, color: '#333' },
  statusSave: { marginLeft: 8, backgroundColor: '#FFC107', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  statusSaveText: { fontSize: 13, fontWeight: '600', color: '#333' },
  divider: { height: 8, backgroundColor: '#f0ead6' },
  sectionTitle: { fontSize: 13, color: '#999', paddingHorizontal: 16, paddingVertical: 10 },
  memberItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  memberAvatar: { marginRight: 14 },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 16, color: '#333' },
  memberStatus: { fontSize: 13, color: '#999', marginTop: 2 },
});
