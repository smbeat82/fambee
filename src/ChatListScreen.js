import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Popup from './Popup';

import { ROOMS } from './constants';

export default function ChatListScreen({ navigation, profile }) {
  const insets = useSafeAreaInsets();
  const [lastMessages, setLastMessages] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});

  // 내가 속한 채팅방만 필터
  const myRooms = ROOMS.filter(room => room.members.includes(profile.id));

  // Firebase에서 각 방의 마지막 메시지 가져오기
  useEffect(() => {
    let unsubscribes = [];
    const loadLastMessages = async () => {
      try {
        const { db } = require('./firebase');
        const { collection, query, orderBy, limit, onSnapshot } = require('firebase/firestore');

        const { doc } = require('firebase/firestore');

        myRooms.forEach(room => {
          const colName = room.id === 'family' ? 'messages' : `messages_${room.id}`;
          const q = query(collection(db, colName), orderBy('createdAt', 'desc'), limit(1));
          const unsub = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
              const msg = snapshot.docs[0].data();
              setLastMessages(prev => ({ ...prev, [room.id]: msg }));
            }
          });
          unsubscribes.push(unsub);

          // unread count 구독
          const unreadRef = doc(db, 'unread', `${room.id}_${profile.id}`);
          const unsubUnread = onSnapshot(unreadRef, (snap) => {
            if (snap.exists()) {
              setUnreadCounts(prev => ({ ...prev, [room.id]: snap.data().count || 0 }));
            }
          });
          unsubscribes.push(unsubUnread);
        });
      } catch (e) {
        console.log('채팅 목록 로드 실패:', e.message);
      }
    };
    loadLastMessages();
    return () => unsubscribes.forEach(u => u());
  }, []);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth();
    if (isToday) {
      const h = date.getHours();
      const m = date.getMinutes();
      const period = h < 12 ? '오전' : '오후';
      return `${period} ${h === 0 ? 12 : h > 12 ? h - 12 : h}:${m.toString().padStart(2, '0')}`;
    }
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // 1:1 채팅방 이름: 상대방 이름으로 표시
  const getRoomName = (room) => {
    if (room.isGroup) return room.name;
    const names = { dad: '아빠', mom: '엄마', hayeon: '하연이' };
    const other = room.members.find(m => m !== profile.id);
    return names[other] || room.name;
  };

  const getRoomEmoji = (room) => {
    if (room.isGroup) return room.emoji;
    const emojis = { dad: '🧔', mom: '👩', hayeon: '👧' };
    const other = room.members.find(m => m !== profile.id);
    return emojis[other] || room.emoji;
  };

  const [popupRoom, setPopupRoom] = useState(null);

  const clearRoomChat = async (roomId) => {
    await AsyncStorage.setItem(`clearBefore_${roomId}`, new Date().toISOString());
    setLastMessages(prev => { const next = { ...prev }; delete next[roomId]; return next; });
    setPopupRoom(null);
  };

  const renderRoom = ({ item }) => {
    const last = lastMessages[item.id];
    return (
      <TouchableOpacity
        style={styles.roomItem}
        onPress={() => navigation.navigate('Chat', { roomId: item.id, roomName: getRoomName(item), isGroup: item.isGroup })}
        onLongPress={() => setPopupRoom(item)}
        delayLongPress={400}
      >
        <View style={styles.roomEmoji}>
          <Text style={styles.roomEmojiText}>{getRoomEmoji(item)}</Text>
        </View>
        <View style={styles.roomInfo}>
          <View style={styles.roomTop}>
            <Text style={styles.roomName}>
              {getRoomName(item)}
              {item.isGroup && <Text style={styles.roomCount}> {item.members.length}</Text>}
            </Text>
            {last && <Text style={styles.roomTime}>{formatTime(last.createdAt)}</Text>}
          </View>
          <View style={styles.roomBottom}>
            <Text style={styles.roomLastMsg} numberOfLines={1}>
              {last ? (last.deleted ? '삭제된 메시지입니다' : last.text) : '대화를 시작해보세요!'}
            </Text>
            {unreadCounts[item.id] > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCounts[item.id]}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>채팅</Text>
      </View>
      <FlatList
        data={myRooms}
        renderItem={renderRoom}
        keyExtractor={item => item.id}
        style={styles.list}
      />
      <Popup
        visible={!!popupRoom}
        title={popupRoom ? getRoomName(popupRoom) : ''}
        onClose={() => setPopupRoom(null)}
        options={popupRoom ? [
          { label: '대화 내용 지우기', onPress: () => clearRoomChat(popupRoom.id), danger: true },
        ] : []}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8E1' },
  header: { backgroundColor: '#FFC107', paddingVertical: 12, paddingHorizontal: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  list: { flex: 1 },
  roomItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  roomEmoji: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#FFF3D4', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  roomEmojiText: { fontSize: 26 },
  roomInfo: { flex: 1 },
  roomTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  roomName: { fontSize: 16, fontWeight: '600', color: '#333' },
  roomCount: { fontSize: 13, fontWeight: 'normal', color: '#999' },
  roomTime: { fontSize: 12, color: '#999' },
  roomBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roomLastMsg: { fontSize: 14, color: '#888', flex: 1 },
  badge: { backgroundColor: '#F44336', borderRadius: 11, minWidth: 22, height: 22, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6, marginLeft: 8 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
});
