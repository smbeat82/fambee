import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, TextInput, TouchableOpacity, Pressable, FlatList, Alert, Modal, StyleSheet, Platform, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import * as Clipboard from 'expo-clipboard';
import Popup from './Popup';
import { ROOMS } from './constants';
import { sendPushToUser } from './notifications';
import * as ImagePicker from 'expo-image-picker';
import ImageViewer from './ImageViewer';
import EmojiPicker from 'rn-emoji-keyboard';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Video, ResizeMode } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours < 12 ? '오전' : '오후';
  const h = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${period} ${h}:${minutes.toString().padStart(2, '0')}`;
};

const formatDate = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${days[date.getDay()]}`;
};

const isSameDay = (t1, t2) => {
  if (!t1 || !t2) return false;
  const d1 = t1.toDate ? t1.toDate() : new Date(t1);
  const d2 = t2.toDate ? t2.toDate() : new Date(t2);
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
};

const isSameMinute = (t1, t2) => {
  if (!t1 || !t2) return false;
  const d1 = t1.toDate ? t1.toDate() : new Date(t1);
  const d2 = t2.toDate ? t2.toDate() : new Date(t2);
  return isSameDay(t1, t2) && d1.getHours() === d2.getHours() && d1.getMinutes() === d2.getMinutes();
};

export default function ChatScreen({ profile, navigation, route, chatBg }) {
  const roomId = route?.params?.roomId || 'family';
  const roomName = route?.params?.roomName || '우리 가족';
  const isGroup = route?.params?.isGroup ?? true;
  const collectionName = roomId === 'family' ? 'messages' : `messages_${roomId}`;

  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([
    { id: 'welcome', text: '안녕하세요~ FamBee에 오신 걸 환영해요! 🐝', userId: 'system' },
  ]);
  const [text, setText] = useState('');
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [memberReadStatus, setMemberReadStatus] = useState({});
  const [memberProfiles, setMemberProfiles] = useState({});
  const flatListRef = useRef();
  const dbRef = useRef(null);
  const inputRef = useRef();
  const typingTimeout = useRef(null);
  const isTypingRef = useRef(false);
  const didScroll = useRef(false);

  // API 35+: 시스템 리사이즈 / API <35: KeyboardStickyView
  const isLegacy = parseInt(Platform.Version, 10) < 35;

  // 개인 대화 내용 지우기 (AsyncStorage 기반, 본인 폰에서만)
  const [clearBefore, setClearBefore] = useState(null);
  useEffect(() => {
    AsyncStorage.getItem(`clearBefore_${roomId}`).then(val => {
      if (val) setClearBefore(new Date(val));
    });
  }, [roomId]);
  const [kbH, setKbH] = useState(0);
  useEffect(() => {
    if (!isLegacy) return;
    const s = Keyboard.addListener('keyboardDidShow', e => setKbH(e.endCoordinates.height));
    const h = Keyboard.addListener('keyboardDidHide', () => setKbH(0));
    return () => { s.remove(); h.remove(); };
  }, []);

  // 채팅방 멤버 정보
  const currentRoom = ROOMS.find(r => r.id === roomId);
  const roomMembers = currentRoom ? currentRoom.members : [];

  // 채팅방 접속 상태 (presence) — 입장/퇴장 시 Firestore에 기록
  useEffect(() => {
    let cleanup = false;
    const setPresence = async (room) => {
      try {
        const { db } = require('./firebase');
        const { doc, setDoc } = require('firebase/firestore');
        await setDoc(doc(db, 'presence', profile.id), { activeRoom: room, updatedAt: new Date() });
      } catch (e) {}
    };
    setPresence(roomId);
    return () => { if (!cleanup) { cleanup = true; setPresence(null); } };
  }, [roomId]);

  // 채팅방 열 때 unread 리셋 + readStatus 업데이트
  const resetUnread = async (db) => {
    try {
      const { doc, setDoc, serverTimestamp } = require('firebase/firestore');
      await setDoc(doc(db, 'unread', `${roomId}_${profile.id}`), { count: 0 });
      await setDoc(doc(db, 'readStatus', `${roomId}_${profile.id}`), { lastReadAt: serverTimestamp() });
    } catch (e) {}
  };

  // 접속 중이 아닌 멤버에게만 푸시 보내기
  const sendPushToOfflineUsers = async (members, senderId, senderName, msgText) => {
    for (const memberId of members) {
      if (memberId === senderId) continue;
      if (await isUserInRoom(memberId)) continue;
      await sendPushToUser(memberId, senderName, msgText);
    }
  };

  // 상대방이 이 채팅방에 접속 중인지 확인
  const isUserInRoom = async (userId) => {
    try {
      const { doc, getDoc } = require('firebase/firestore');
      const snap = await getDoc(doc(dbRef.current, 'presence', userId));
      return snap.exists() && snap.data().activeRoom === roomId;
    } catch (e) { return false; }
  };

  // 메시지 전송 시 상대방 unread 증가 (접속 중이면 스킵)
  const incrementUnread = async () => {
    if (!dbRef.current) return;
    try {
      const { doc, setDoc, getDoc } = require('firebase/firestore');
      for (const memberId of roomMembers) {
        if (memberId === profile.id) continue;
        if (await isUserInRoom(memberId)) continue;
        const ref = doc(dbRef.current, 'unread', `${roomId}_${memberId}`);
        const snap = await getDoc(ref);
        const current = snap.exists() ? snap.data().count || 0 : 0;
        await setDoc(ref, { count: current + 1 });
      }
    } catch (e) {}
  };

  // Firebase 연결 — 메시지 + 타이핑 구독
  useEffect(() => {
    let unsubs = [];
    const connectFirebase = async () => {
      try {
        const { db } = require('./firebase');
        const { collection, query, orderBy, onSnapshot, doc } = require('firebase/firestore');
        dbRef.current = db;
        resetUnread(db);

        const q = query(collection(db, collectionName), orderBy('createdAt', 'asc'));
        unsubs.push(onSnapshot(q, (snapshot) => {
          const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          if (msgs.length > 0) setMessages(msgs);
          resetUnread(db);
        }, (err) => {
          console.log('Firestore 에러:', err.message);
        }));

        unsubs.push(onSnapshot(collection(db, 'typing'), (snapshot) => {
          const users = [];
          snapshot.docs.forEach(d => {
            const data = d.data();
            if (d.id !== profile.id && data.isTyping) {
              users.push({ name: data.userName, emoji: data.userEmoji });
            }
          });
          setTypingUsers(users);
        }));

        // 프로필 사진 구독
        unsubs.push(onSnapshot(collection(db, 'profiles'), (snapshot) => {
          const data = {};
          snapshot.docs.forEach(d => { data[d.id] = d.data(); });
          setMemberProfiles(data);
        }));

        // 다른 멤버의 readStatus 구독 (안 읽은 수 계산용)
        roomMembers.filter(id => id !== profile.id).forEach(memberId => {
          unsubs.push(onSnapshot(doc(db, 'readStatus', `${roomId}_${memberId}`), (snap) => {
            if (snap.exists()) {
              setMemberReadStatus(prev => ({ ...prev, [memberId]: snap.data().lastReadAt }));
            }
          }));
        });
      } catch (e) {
        console.log('Firebase 연결 실패:', e.message);
      }
    };
    connectFirebase();
    return () => {
      unsubs.forEach(u => u());
      updateTyping(false);
      if (dbRef.current) resetUnread(dbRef.current);
    };
  }, []);

  const updateTyping = async (isTyping) => {
    if (isTypingRef.current === isTyping) return;
    isTypingRef.current = isTyping;
    if (!dbRef.current) return;
    try {
      const { doc, setDoc, serverTimestamp } = require('firebase/firestore');
      await setDoc(doc(dbRef.current, 'typing', profile.id), {
        isTyping,
        userName: profile.name,
        userEmoji: profile.emoji,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.log('타이핑 상태 업데이트 실패:', e.message);
    }
  };

  const handleTextChange = (value) => {
    setText(value);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    if (value.trim()) {
      updateTyping(true);
      typingTimeout.current = setTimeout(() => updateTyping(false), 3000);
    } else {
      updateTyping(false);
    }
  };

  const sendMessage = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    updateTyping(false);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);

    if (editingMsg) {
      if (dbRef.current) {
        try {
          const { doc, updateDoc, serverTimestamp } = require('firebase/firestore');
          await updateDoc(doc(dbRef.current, collectionName, editingMsg.id), {
            text: trimmed,
            editedAt: serverTimestamp(),
          });
        } catch (e) {
          console.log('수정 실패:', e.message);
        }
      }
      setEditingMsg(null);
      return;
    }

    if (dbRef.current) {
      try {
        const { collection, addDoc, serverTimestamp } = require('firebase/firestore');
        await addDoc(collection(dbRef.current, collectionName), {
          text: trimmed,
          userId: profile.id,
          userName: profile.name,
          userEmoji: profile.emoji,
          createdAt: serverTimestamp(),
        });
        incrementUnread();
        sendPushToOfflineUsers(roomMembers, profile.id, profile.name, trimmed);
        return;
      } catch (e) {
        console.log('전송 실패:', e.message);
      }
    }

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      text: trimmed,
      userId: profile.id,
      userName: profile.name,
      userEmoji: profile.emoji,
      createdAt: new Date(),
    }]);
  };

  // 이미지 전송
  const STORAGE_LIMIT = 4.5 * 1024 * 1024 * 1024; // 4.5GB (5GB에서 여유)

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      maxWidth: 1200,
      maxHeight: 1200,
    });
    if (!result.canceled) {
      await uploadAndSendImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.5,
      maxWidth: 1200,
      maxHeight: 1200,
    });
    if (!result.canceled) {
      await uploadAndSendImage(result.assets[0].uri);
    }
  };

  const uploadAndSendImage = async (uri) => {
    if (!dbRef.current) return;
    setUploading(true);
    try {
      const { storage } = require('./firebase');
      const { ref, uploadBytes, getDownloadURL } = require('firebase/storage');
      const { collection, addDoc, serverTimestamp } = require('firebase/firestore');

      const { doc, getDoc, setDoc } = require('firebase/firestore');
      const response = await fetch(uri);
      const blob = await response.blob();

      // Storage 사용량 체크 (4.5GB 초과 시 차단)
      const usageRef = doc(dbRef.current, 'storageUsage', 'total');
      const usageSnap = await getDoc(usageRef);
      const currentUsage = usageSnap.exists() ? usageSnap.data().bytes || 0 : 0;

      if (currentUsage + blob.size > STORAGE_LIMIT) {
        Alert.alert('저장 공간 부족', 'Storage 용량이 거의 찼습니다 (4.5GB/5GB).\n설정에서 오래된 이미지를 삭제해주세요.');
        return;
      }

      const filename = `chat/${collectionName}/${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, blob);
      const imageUrl = await getDownloadURL(storageRef);

      // 사용량 업데이트
      await setDoc(usageRef, { bytes: currentUsage + blob.size });

      await addDoc(collection(dbRef.current, collectionName), {
        text: '',
        imageUrl,
        userId: profile.id,
        userName: profile.name,
        userEmoji: profile.emoji,
        createdAt: serverTimestamp(),
      });
      incrementUnread();
      sendPushToOfflineUsers(roomMembers, profile.id, profile.name, '사진을 보냈습니다');
    } catch (e) {
      console.log('이미지 전송 실패:', e.message);
      Alert.alert('전송 실패', '이미지를 전송하지 못했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const [imagePopup, setImagePopup] = useState(false);
  const [playingVideo, setPlayingVideo] = useState(null);
  const [viewingImage, setViewingImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

  // 영상 전송
  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 0.5,
      videoMaxDuration: 60,
    });
    if (!result.canceled) {
      await uploadAndSendVideo(result.assets[0].uri);
    }
  };

  const recordVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      quality: 0.5,
      videoMaxDuration: 60,
    });
    if (!result.canceled) {
      await uploadAndSendVideo(result.assets[0].uri);
    }
  };

  const uploadAndSendVideo = async (uri) => {
    if (!dbRef.current) return;
    setUploading(true);
    try {
      const { storage } = require('./firebase');
      const { ref, uploadBytes, getDownloadURL } = require('firebase/storage');
      const { collection, addDoc, serverTimestamp, doc, getDoc, setDoc } = require('firebase/firestore');

      // 썸네일 생성
      let thumbnailUrl = '';
      try {
        const thumb = await VideoThumbnails.getThumbnailAsync(uri, { time: 1000, quality: 0.3 });
        const thumbResponse = await fetch(thumb.uri);
        const thumbBlob = await thumbResponse.blob();
        const thumbRef = ref(storage, `chat/${collectionName}/thumb_${Date.now()}.jpg`);
        await uploadBytes(thumbRef, thumbBlob);
        thumbnailUrl = await getDownloadURL(thumbRef);
      } catch (e) {
        console.log('썸네일 생성 실패:', e.message);
      }

      // 영상 업로드
      const response = await fetch(uri);
      const blob = await response.blob();

      // Storage 사용량 체크
      const usageRef = doc(dbRef.current, 'storageUsage', 'total');
      const usageSnap = await getDoc(usageRef);
      const currentUsage = usageSnap.exists() ? usageSnap.data().bytes || 0 : 0;

      if (currentUsage + blob.size > STORAGE_LIMIT) {
        Alert.alert('저장 공간 부족', 'Storage 용량이 거의 찼습니다.\n설정에서 오래된 미디어를 삭제해주세요.');
        return;
      }

      const filename = `chat/${collectionName}/${Date.now()}.mp4`;
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, blob);
      const videoUrl = await getDownloadURL(storageRef);

      await setDoc(usageRef, { bytes: currentUsage + blob.size });

      await addDoc(collection(dbRef.current, collectionName), {
        text: '',
        videoUrl,
        thumbnailUrl,
        userId: profile.id,
        userName: profile.name,
        userEmoji: profile.emoji,
        createdAt: serverTimestamp(),
      });
      incrementUnread();
      sendPushToOfflineUsers(roomMembers, profile.id, profile.name, '영상을 보냈습니다');
    } catch (e) {
      console.log('영상 전송 실패:', e.message);
      Alert.alert('전송 실패', '영상을 전송하지 못했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const onLongPress = (item) => {
    if (item.userId === 'system' || item.deleted) return;
    setSelectedMsg(item);
  };

  const handleCopy = async () => {
    if (selectedMsg) await Clipboard.setStringAsync(selectedMsg.text);
    setSelectedMsg(null);
  };

  const handleEdit = () => {
    if (selectedMsg) {
      setEditingMsg(selectedMsg);
      setText(selectedMsg.text);
    }
    setSelectedMsg(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const cancelEdit = () => {
    setEditingMsg(null);
    setText('');
  };

  const handleDelete = () => {
    const msgToDelete = selectedMsg;
    setSelectedMsg(null);
    setTimeout(() => {
      Alert.alert('메시지 삭제', '이 메시지를 삭제하시겠습니까?', [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제', style: 'destructive', onPress: async () => {
            if (msgToDelete && dbRef.current) {
              try {
                const { doc, updateDoc } = require('firebase/firestore');
                await updateDoc(doc(dbRef.current, collectionName, msgToDelete.id), { deleted: true });
              } catch (e) {
                console.log('삭제 실패:', e.message);
              }
            }
          }
        },
      ]);
    }, 300);
  };

  // 프로필 아바타 렌더링 (사진 or 이모지)
  const renderAvatar = (userId, emoji) => {
    const photo = memberProfiles[userId]?.photoUrl;
    if (photo) {
      return <Image source={{ uri: photo }} style={styles.avatarImage} />;
    }
    return <Text style={styles.msgEmoji}>{emoji}</Text>;
  };

  // 내 메시지의 안 읽은 수 계산 (readStatus에 있는 멤버만 — 스마트 카운트)
  const getUnreadCount = (msg) => {
    if (!msg.createdAt) return 0;
    const msgTime = msg.createdAt.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt);
    let count = 0;
    for (const [memberId, lastRead] of Object.entries(memberReadStatus)) {
      if (!lastRead) { count++; continue; }
      const readTime = lastRead.toDate ? lastRead.toDate() : new Date(lastRead);
      if (msgTime > readTime) count++;
    }
    return count;
  };

  const renderMessage = ({ item, index }) => {
    const isMe = item.userId === profile.id;
    const isSystem = item.userId === 'system';

    const prev = index > 0 ? displayMessages[index - 1] : null;
    const next = index < displayMessages.length - 1 ? displayMessages[index + 1] : null;

    const showDate = item.createdAt && (!prev ? true : (prev.createdAt ? !isSameDay(prev.createdAt, item.createdAt) : false));

    if (isSystem) {
      return (
        <View style={styles.systemRow}>
          <Text style={styles.systemText}>{item.text}</Text>
        </View>
      );
    }

    const prevIsSame = prev && prev.userId === item.userId && prev.userId !== 'system' && !showDate;
    const nextIsSame = next && next.userId === item.userId && next.userId !== 'system' && isSameDay(item.createdAt, next?.createdAt);
    const isFirst = !prevIsSame;
    const isLast = !nextIsSame;

    if (item.deleted) {
      return (
        <View>
          {showDate && (
            <View style={styles.dateRow}>
              <View style={styles.dateLine} />
              <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
              <View style={styles.dateLine} />
            </View>
          )}
          <View style={[
            styles.msgRow, isMe && styles.msgRowMe,
            isLast ? styles.msgRowLast : styles.msgRowCont,
          ]}>
            {!isMe && (isFirst ? renderAvatar(item.userId, item.userEmoji) : <View style={styles.msgEmojiSpace} />)}
            <View style={styles.msgContent}>
              {!isMe && isFirst && <Text style={styles.msgName}>{item.userName}</Text>}
              <View style={styles.deletedBubble}>
                <Text style={styles.deletedText}>삭제된 메시지입니다</Text>
              </View>
            </View>
          </View>
        </View>
      );
    }

    const showTime = isLast || !isSameMinute(item.createdAt, next?.createdAt);
    const timeStr = showTime ? formatTime(item.createdAt) : null;

    return (
      <View>
        {showDate && (
          <View style={styles.dateRow}>
            <View style={styles.dateLine} />
            <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
            <View style={styles.dateLine} />
          </View>
        )}
        <Pressable onLongPress={() => onLongPress(item)} delayLongPress={300}>
          <View style={[
            styles.msgRow, isMe && styles.msgRowMe,
            isLast ? styles.msgRowLast : styles.msgRowCont,
          ]}>
            {!isMe && (isFirst ? renderAvatar(item.userId, item.userEmoji) : <View style={styles.msgEmojiSpace} />)}

            <View style={styles.msgContent}>
              {!isMe && isFirst && <Text style={styles.msgName}>{item.userName}</Text>}

              <View style={[styles.msgBubbleRow, isMe && styles.msgBubbleRowMe]}>
                <View style={[
                  styles.bubble,
                  isMe ? styles.bubbleMe : styles.bubbleOther,
                  isFirst && !isMe && styles.bubbleTailOther,
                  isFirst && isMe && styles.bubbleTailMe,
                  (item.imageUrl || item.videoUrl) && styles.imageBubble,
                ]}>
                  {item.videoUrl ? (
                    <TouchableOpacity onPress={() => setPlayingVideo(item.videoUrl)}>
                      <View style={styles.videoThumb}>
                        {item.thumbnailUrl ? (
                          <Image source={{ uri: item.thumbnailUrl }} style={styles.msgImage} resizeMode="cover" />
                        ) : (
                          <View style={[styles.msgImage, styles.videoPlaceholder]} />
                        )}
                        <View style={styles.playBtn}>
                          <Text style={styles.playBtnText}>▶</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ) : item.imageUrl ? (
                    <TouchableOpacity onPress={() => setViewingImage(item.imageUrl)}>
                      <Image source={{ uri: item.imageUrl }} style={styles.msgImage} resizeMode="cover" />
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.msgText}>{item.text}</Text>
                  )}
                  {item.editedAt && <Text style={styles.editedLabel}>(수정됨)</Text>}
                </View>

                {(timeStr || (isMe && getUnreadCount(item) > 0)) && (
                  <View style={styles.msgMeta}>
                    {isMe && getUnreadCount(item) > 0 && (
                      <Text style={styles.unreadCount}>{getUnreadCount(item)}</Text>
                    )}
                    {timeStr && <Text style={styles.timeText}>{timeStr}</Text>}
                  </View>
                )}
              </View>
            </View>
          </View>
        </Pressable>
      </View>
    );
  };

  // 필터링된 메시지 (prev/next 계산에 사용)
  const displayMessages = clearBefore ? messages.filter(m => {
    if (!m.createdAt) return false;
    const d = m.createdAt.toDate ? m.createdAt.toDate() : new Date(m.createdAt);
    return d > clearBefore;
  }) : messages;

  const isMyMsg = selectedMsg?.userId === profile.id;

  return (
    <View style={[styles.container, { backgroundColor: chatBg || '#FFF8E1', paddingTop: insets.top, paddingBottom: isLegacy ? insets.bottom : 0 }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Text style={styles.headerBack}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isGroup ? '🐝 ' : ''}{roomName}</Text>
        <View style={styles.headerRight}>
          {!isGroup && (
            <>
              <TouchableOpacity style={styles.headerCallBtn} onPress={() => {
                const other = roomMembers.find(m => m !== profile.id);
                const id = `${profile.id}_${other}_${Date.now()}`;
                navigation.navigate('Call', { callId: id, calleeId: other, isVideo: false });
              }}>
                <Text style={styles.headerCallIcon}>📞</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerCallBtn} onPress={() => {
                const other = roomMembers.find(m => m !== profile.id);
                const id = `${profile.id}_${other}_${Date.now()}`;
                navigation.navigate('Call', { callId: id, calleeId: other, isVideo: true });
              }}>
                <Text style={styles.headerCallIcon}>📹</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* 메시지 리스트 */}
      <FlatList
        ref={flatListRef}
        data={displayMessages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        style={[styles.list, isLegacy && kbH > 0 && { marginBottom: kbH }]}
        contentContainerStyle={{ padding: 12, paddingBottom: isLegacy ? Math.max(0, 60 - insets.bottom) : 8 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
        onTouchStart={() => { didScroll.current = false; }}
        onScrollBeginDrag={() => { didScroll.current = true; }}
        onTouchEnd={() => { if (!didScroll.current) Keyboard.dismiss(); }}
      />

      {/* 업로드 상태 */}
      {uploading && (
        <View style={styles.typingRow}>
          <Text style={styles.typingText}>사진 전송 중...</Text>
        </View>
      )}

      {/* 타이핑 인디케이터 */}
      {typingUsers.length > 0 && (
        <View style={styles.typingRow}>
          <Text style={styles.typingEmoji}>{typingUsers[0].emoji}</Text>
          <Text style={styles.typingText}>
            {typingUsers.map(u => u.name).join(', ')}님이 입력 중
          </Text>
          <Text style={styles.typingDots}>...</Text>
        </View>
      )}

      {/* 입력 영역 — 폰 버전별 분기 */}
      {isLegacy ? (
        <KeyboardStickyView offset={{ closed: 0, opened: 50 }}>
          {editingMsg && (
            <View style={styles.editBar}>
              <View style={styles.editBarLeft}>
                <Text style={styles.editBarIcon}>✏️</Text>
                <View style={styles.editBarContent}>
                  <Text style={styles.editBarTitle}>메시지 수정</Text>
                  <Text style={styles.editBarText} numberOfLines={1}>{editingMsg.text}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={cancelEdit} style={styles.editBarClose}>
                <Text style={styles.editBarCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.imageBtn} onPress={() => setImagePopup(true)}>
              <Text style={styles.imageBtnText}>+</Text>
            </TouchableOpacity>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={text}
              onChangeText={handleTextChange}
              placeholder={editingMsg ? '메시지 수정...' : '메시지 입력...'}
              placeholderTextColor="#999"
              returnKeyType="send"
              onSubmitEditing={sendMessage}
              blurOnSubmit={false}
            />
            <TouchableOpacity style={styles.emojiBtn} onPress={() => { Keyboard.dismiss(); setEmojiOpen(true); }}>
              <Text style={styles.emojiBtnText}>😊</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sendBtn, editingMsg && styles.sendBtnEdit]} onPress={sendMessage}>
              <Text style={styles.sendText}>{editingMsg ? '✓' : '🐝'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardStickyView>
      ) : (
        <>
          {editingMsg && (
            <View style={styles.editBar}>
              <View style={styles.editBarLeft}>
                <Text style={styles.editBarIcon}>✏️</Text>
                <View style={styles.editBarContent}>
                  <Text style={styles.editBarTitle}>메시지 수정</Text>
                  <Text style={styles.editBarText} numberOfLines={1}>{editingMsg.text}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={cancelEdit} style={styles.editBarClose}>
                <Text style={styles.editBarCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.imageBtn} onPress={() => setImagePopup(true)}>
              <Text style={styles.imageBtnText}>+</Text>
            </TouchableOpacity>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={text}
              onChangeText={handleTextChange}
              placeholder={editingMsg ? '메시지 수정...' : '메시지 입력...'}
              placeholderTextColor="#999"
              returnKeyType="send"
              onSubmitEditing={sendMessage}
              blurOnSubmit={false}
            />
            <TouchableOpacity style={styles.emojiBtn} onPress={() => { Keyboard.dismiss(); setEmojiOpen(true); }}>
              <Text style={styles.emojiBtnText}>😊</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sendBtn, editingMsg && styles.sendBtnEdit]} onPress={sendMessage}>
              <Text style={styles.sendText}>{editingMsg ? '✓' : '🐝'}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: insets.bottom }} />
        </>
      )}

      {/* 길게 누르기 메뉴 */}
      <EmojiPicker
        onEmojiSelected={(emoji) => setText(prev => prev + emoji.emoji)}
        open={emojiOpen}
        onClose={() => setEmojiOpen(false)}
        theme={{ backdrop: '#00000030', knob: '#FFC107', container: '#fff', header: '#FFC107', category: { icon: '#FFA000', iconActive: '#FFC107', container: '#fff' } }}
      />

      {/* 영상 플레이어 */}
      {playingVideo && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPlayingVideo(null)}>
          <View style={styles.videoModal}>
            <Video
              source={{ uri: playingVideo }}
              style={styles.videoPlayer}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
            />
            <TouchableOpacity style={styles.videoClose} onPress={() => setPlayingVideo(null)}>
              <Text style={styles.videoCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}

      <ImageViewer
        visible={!!viewingImage}
        imageUrl={viewingImage}
        onClose={() => setViewingImage(null)}
      />

      <Popup
        visible={imagePopup}
        onClose={() => setImagePopup(false)}
        options={[
          { label: '사진 보내기', onPress: () => { setImagePopup(false); pickImage(); } },
          { label: '사진 촬영', onPress: () => { setImagePopup(false); takePhoto(); } },
          { label: '영상 보내기', onPress: () => { setImagePopup(false); pickVideo(); } },
          { label: '영상 촬영', onPress: () => { setImagePopup(false); recordVideo(); } },
        ]}
      />

      <Popup
        visible={!!selectedMsg}
        onClose={() => setSelectedMsg(null)}
        options={[
          { label: '복사', onPress: handleCopy },
          ...(isMyMsg ? [
            { label: '수정', onPress: handleEdit },
            { label: '삭제', onPress: handleDelete, danger: true },
          ] : []),
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // 헤더
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFC107', paddingVertical: 5, paddingHorizontal: 16 },
  headerBtn: { padding: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerCallBtn: { padding: 6 },
  headerCallIcon: { fontSize: 20 },
  headerBack: { fontSize: 20, color: '#333' },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  headerProfile: { fontSize: 13, color: '#555' },

  // 리스트
  list: { flex: 1 },

  // 날짜 구분선
  dateRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, paddingHorizontal: 8 },
  dateLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#ccc' },
  dateText: { fontSize: 12, color: '#999', marginHorizontal: 10 },

  // 시스템 메시지
  systemRow: { alignItems: 'center', marginBottom: 12, marginTop: 4 },
  systemText: { fontSize: 13, color: '#999', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },

  // 메시지 행
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 4 },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgRowCont: { marginBottom: 2 },
  msgRowLast: { marginBottom: 10 },

  // 프로필 이모지/사진
  msgEmoji: { fontSize: 28, marginRight: 6, marginBottom: 2 },
  avatarImage: { width: 32, height: 32, borderRadius: 10, marginRight: 6, marginBottom: 2 },
  msgEmojiSpace: { width: 38 },

  // 메시지 컨텐츠
  msgContent: { maxWidth: '75%' },
  msgName: { fontSize: 11, color: '#888', marginBottom: 3, marginLeft: 2 },

  // 말풍선 + 시간
  msgBubbleRow: { flexDirection: 'row', alignItems: 'flex-end' },
  msgBubbleRowMe: { flexDirection: 'row-reverse' },

  // 말풍선
  bubble: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16 },
  bubbleOther: { backgroundColor: '#fff' },
  bubbleMe: { backgroundColor: '#FFC107' },
  bubbleTailOther: { borderTopLeftRadius: 4 },
  bubbleTailMe: { borderTopRightRadius: 4 },

  // 텍스트
  msgText: { fontSize: 15, color: '#333', lineHeight: 21 },
  editedLabel: { fontSize: 11, color: '#999', marginTop: 2 },

  // 삭제된 메시지
  deletedBubble: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#e0e0e0', borderStyle: 'dashed' },
  deletedText: { fontSize: 14, color: '#aaa', fontStyle: 'italic' },

  // 시간 + 안읽은수
  msgMeta: { alignItems: 'flex-end', justifyContent: 'flex-end', marginHorizontal: 4, marginBottom: 2 },
  unreadCount: { fontSize: 11, color: '#FFA000', fontWeight: 'bold', marginBottom: 1 },
  timeText: { fontSize: 11, color: '#999' },

  // 타이핑 인디케이터
  typingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#FFF8E1' },
  typingEmoji: { fontSize: 16, marginRight: 6 },
  typingText: { fontSize: 13, color: '#999' },
  typingDots: { fontSize: 13, color: '#999', marginLeft: 2 },

  // 수정 모드 바
  editBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF3D4', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#eee' },
  editBarLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  editBarIcon: { fontSize: 16, marginRight: 8 },
  editBarContent: { flex: 1 },
  editBarTitle: { fontSize: 12, fontWeight: 'bold', color: '#FFA000' },
  editBarText: { fontSize: 13, color: '#666' },
  editBarClose: { padding: 6 },
  editBarCloseText: { fontSize: 18, color: '#999' },

  // 이미지/영상 메시지
  imageBubble: { padding: 3, overflow: 'hidden' },
  msgImage: { width: 200, height: 200, borderRadius: 14 },
  videoThumb: { position: 'relative' },
  videoPlaceholder: { backgroundColor: '#333' },
  playBtn: { position: 'absolute', top: '50%', left: '50%', marginTop: -24, marginLeft: -24, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  playBtnText: { color: '#fff', fontSize: 20, marginLeft: 3 },
  videoModal: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  videoPlayer: { width: '100%', height: '80%' },
  videoClose: { position: 'absolute', top: 50, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  videoCloseText: { color: '#fff', fontSize: 18 },

  // 입력
  imageBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFC107', justifyContent: 'center', alignItems: 'center', marginRight: 6, alignSelf: 'center' },
  imageBtnText: { fontSize: 22, color: '#fff', fontWeight: 'bold', marginTop: -2 },
  emojiBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginRight: 4 },
  emojiBtnText: { fontSize: 22 },
  inputRow: { flexDirection: 'row', padding: 8, backgroundColor: '#FFF8E1' },
  input: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: '#333' },
  sendBtn: { backgroundColor: '#FFC107', borderRadius: 22, width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  sendBtnEdit: { backgroundColor: '#4CAF50' },
  sendText: { fontSize: 20 },

});
