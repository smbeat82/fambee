import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, PermissionsAndroid, Platform } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';
import {
  getMediaStream, createPeerConnection, createOffer, createAnswer,
  setAnswer, addIceCandidate, endCall, toggleMute, switchCamera, toggleVideo,
  startInCallManager,
} from './callService';
import { sendPushToUser } from './notifications';

const FAMILY_NAMES = { dad: '아빠', mom: '엄마', hayeon: '하연이' };
const FAMILY_EMOJIS = { dad: '🧔', mom: '👩', hayeon: '👧' };

export default function CallScreen({ profile, navigation, route }) {
  const callId = route?.params?.callId;
  const calleeId = route?.params?.calleeId;
  const isIncoming = route?.params?.isIncoming || false;
  const isVideo = route?.params?.isVideo || false;
  const callerId = route?.params?.callerId;
  const otherUserId = isIncoming ? callerId : calleeId;
  const otherName = FAMILY_NAMES[otherUserId] || '상대방';
  const otherEmoji = FAMILY_EMOJIS[otherUserId] || '📞';

  const [status, setStatus] = useState(isIncoming ? 'ringing' : 'calling');
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [speaker, setSpeaker] = useState(isVideo);
  const [localStreamURL, setLocalStreamURL] = useState(null);
  const [remoteStreamURL, setRemoteStreamURL] = useState(null);
  const [callTime, setCallTime] = useState(0);
  const timerRef = useRef(null);
  const unsubRefs = useRef([]);
  const callTimeRef = useRef(0);
  const statusRef = useRef(status);

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { callTimeRef.current = callTime; }, [callTime]);

  // 권한 요청
  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      const perms = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
      if (isVideo) perms.push(PermissionsAndroid.PERMISSIONS.CAMERA);
      await PermissionsAndroid.requestMultiple(perms);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      await requestPermissions();
      // InCallManager 미리 시작 (오디오 라우팅 준비)
      startInCallManager(isVideo);
      const stream = await getMediaStream(isVideo);
      if (cancelled) return;
      setLocalStreamURL(stream.toURL());

      if (isIncoming) {
        // 수신: 수락 대기
      } else {
        await handleOutgoing();
      }
    };
    start().catch(e => console.log('통화 시작 실패:', e.message));
    return () => {
      cancelled = true;
      cleanup(false);
    };
  }, []);

  // 통화 타이머
  useEffect(() => {
    if (status === 'connected') {
      timerRef.current = setInterval(() => setCallTime(t => t + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status]);

  const formatCallTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const onConnected = () => {
    setStatus('connected');
  };

  // 발신 (전화 거는 쪽)
  const handleOutgoing = async () => {
    const { db } = require('./firebase');
    const { doc, setDoc, onSnapshot, collection, addDoc } = require('firebase/firestore');

    const pc = createPeerConnection(
      (remoteStream) => { setRemoteStreamURL(remoteStream.toURL()); },
      async (candidate) => { await addDoc(collection(db, 'calls', callId, 'offerCandidates'), candidate); },
      onConnected,
    );

    const offer = await createOffer();
    await setDoc(doc(db, 'calls', callId), {
      callerId: profile.id,
      calleeId,
      type: isVideo ? 'video' : 'voice',
      status: 'ringing',
      offer,
      createdAt: new Date(),
    });

    // FCM 푸시로 상대방에게 전화 알림 (백그라운드 수신 지원)
    const callType = isVideo ? '영상통화' : '음성통화';
    await sendPushToUser(calleeId, `${profile.name}의 ${callType}`, '전화가 왔어요! 탭하여 받기');

    // answer 리스닝
    const unsubAnswer = onSnapshot(doc(db, 'calls', callId), async (snap) => {
      const data = snap.data();
      if (!data) return;
      if (data.answer && pc.remoteDescription === null) {
        await setAnswer(data.answer);
      }
      if (data.status === 'ended' && statusRef.current !== 'ended') {
        await saveCallRecord();
        cleanup(false);
        navigation.goBack();
      }
    });
    unsubRefs.current.push(unsubAnswer);

    // 수신자 ICE 후보 리스닝
    const unsubIce = onSnapshot(collection(db, 'calls', callId, 'answerCandidates'), (snap) => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          addIceCandidate(change.doc.data());
        }
      });
    });
    unsubRefs.current.push(unsubIce);

    // 30초 응답 없으면 자동 종료
    setTimeout(async () => {
      if (statusRef.current === 'calling') {
        await saveCallRecord();
        await cleanup(true);
        Alert.alert('응답 없음', `${otherName}이(가) 응답하지 않았어요`);
        navigation.goBack();
      }
    }, 30000);
  };

  const acceptCall = async () => {
    setStatus('connecting');
    const { db } = require('./firebase');
    const { doc, updateDoc, onSnapshot, collection, addDoc, getDoc } = require('firebase/firestore');

    const callDoc = await getDoc(doc(db, 'calls', callId));
    if (!callDoc.exists()) return;
    const callData = callDoc.data();

    const pc = createPeerConnection(
      (remoteStream) => { setRemoteStreamURL(remoteStream.toURL()); },
      async (candidate) => { await addDoc(collection(db, 'calls', callId, 'answerCandidates'), candidate); },
      onConnected,
    );

    const answer = await createAnswer(callData.offer);
    await updateDoc(doc(db, 'calls', callId), { answer, status: 'answered' });

    // 발신자 ICE 후보 리스닝
    const unsubIce = onSnapshot(collection(db, 'calls', callId, 'offerCandidates'), (snap) => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          addIceCandidate(change.doc.data());
        }
      });
    });
    unsubRefs.current.push(unsubIce);

    // 통화 종료 감지
    const unsubCall = onSnapshot(doc(db, 'calls', callId), async (snap) => {
      if (snap.data()?.status === 'ended' && statusRef.current !== 'ended') {
        await saveCallRecord();
        cleanup(false);
        navigation.goBack();
      }
    });
    unsubRefs.current.push(unsubCall);
  };

  const cleanup = async (updateDb = true) => {
    setStatus('ended');
    if (timerRef.current) clearInterval(timerRef.current);
    unsubRefs.current.forEach(u => u());
    unsubRefs.current = [];
    endCall();
    if (updateDb && callId) {
      try {
        const { db } = require('./firebase');
        const { doc, updateDoc } = require('firebase/firestore');
        await updateDoc(doc(db, 'calls', callId), { status: 'ended' });
      } catch (e) {}
    }
  };

  // 통화 기록을 채팅방에 남기기
  const saveCallRecord = async () => {
    try {
      const { db } = require('./firebase');
      const { collection, addDoc, serverTimestamp } = require('firebase/firestore');
      const { ROOMS } = require('./constants');
      const room = ROOMS.find(r => !r.isGroup && r.members.includes(profile.id) && r.members.includes(otherUserId));
      if (!room) return;
      const colName = room.id === 'family' ? 'messages' : `messages_${room.id}`;
      const duration = formatCallTime(callTimeRef.current);
      const callType = isVideo ? '영상통화' : '음성통화';
      const text = callTimeRef.current > 0 ? `📞 ${callType} ${duration}` : `📞 부재중 ${callType}`;
      await addDoc(collection(db, colName), {
        text,
        userId: 'system',
        type: 'call',
        createdAt: serverTimestamp(),
      });
    } catch (e) { console.log('통화 기록 저장 실패:', e.message); }
  };

  const handleHangUp = async () => {
    await saveCallRecord();
    await cleanup(true);
    navigation.goBack();
  };

  const rejectCall = async () => {
    await cleanup(true);
    navigation.goBack();
  };

  // 수신 화면 (벨 울리는 중)
  if (status === 'ringing' && isIncoming) {
    return (
      <View style={styles.container}>
        <Text style={styles.callerEmoji}>{otherEmoji}</Text>
        <Text style={styles.callerName}>{otherName}</Text>
        <Text style={styles.statusText}>{isVideo ? '영상통화' : '음성통화'} 수신 중...</Text>
        <View style={styles.incomingBtns}>
          <TouchableOpacity style={[styles.callBtn, styles.rejectBtn]} onPress={rejectCall}>
            <Text style={styles.callBtnText}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.callBtn, styles.acceptBtn]} onPress={acceptCall}>
            <Text style={styles.callBtnText}>✓</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isVideo && remoteStreamURL && (
        <RTCView streamURL={remoteStreamURL} style={styles.remoteVideo} objectFit="cover" />
      )}
      {isVideo && localStreamURL && !videoOff && (
        <RTCView streamURL={localStreamURL} style={styles.localVideo} objectFit="cover" mirror />
      )}

      {(!isVideo || !remoteStreamURL) && (
        <View style={styles.voiceInfo}>
          <Text style={styles.callerEmoji}>{otherEmoji}</Text>
          <Text style={styles.callerName}>{otherName}</Text>
          <Text style={styles.statusText}>
            {status === 'calling' ? '연결 중...' :
             status === 'connecting' ? '연결 중...' :
             status === 'connected' ? formatCallTime(callTime) : ''}
          </Text>
        </View>
      )}

      {isVideo && status === 'connected' && (
        <View style={styles.videoTimer}>
          <Text style={styles.videoTimerText}>{formatCallTime(callTime)}</Text>
        </View>
      )}

      <View style={styles.controls}>
        <TouchableOpacity style={[styles.ctrlBtn, muted && styles.ctrlActive]} onPress={() => setMuted(toggleMute())}>
          <Text style={styles.ctrlText}>{muted ? '🔇' : '🎤'}</Text>
          <Text style={styles.ctrlLabel}>{muted ? '음소거' : '마이크'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.ctrlBtn, speaker && styles.ctrlActive]} onPress={() => {
          const next = !speaker;
          setSpeaker(next);
          InCallManager.setSpeakerphoneOn(next);
        }}>
          <Text style={styles.ctrlText}>{speaker ? '🔊' : '📱'}</Text>
          <Text style={styles.ctrlLabel}>{speaker ? '스피커' : '수화기'}</Text>
        </TouchableOpacity>

        {isVideo && (
          <>
            <TouchableOpacity style={[styles.ctrlBtn, videoOff && styles.ctrlActive]} onPress={() => setVideoOff(toggleVideo())}>
              <Text style={styles.ctrlText}>{videoOff ? '📷' : '🎥'}</Text>
              <Text style={styles.ctrlLabel}>{videoOff ? '카메라 끔' : '카메라'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctrlBtn} onPress={switchCamera}>
              <Text style={styles.ctrlText}>🔄</Text>
              <Text style={styles.ctrlLabel}>전환</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={[styles.callBtn, styles.hangUpBtn]} onPress={handleHangUp}>
          <Text style={styles.callBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' },
  voiceInfo: { alignItems: 'center' },
  callerEmoji: { fontSize: 80, marginBottom: 16 },
  callerName: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  statusText: { fontSize: 16, color: '#aaa' },
  incomingBtns: { flexDirection: 'row', marginTop: 60, gap: 40 },
  callBtn: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center' },
  callBtnText: { fontSize: 30, color: '#fff', fontWeight: 'bold' },
  rejectBtn: { backgroundColor: '#F44336' },
  acceptBtn: { backgroundColor: '#4CAF50' },
  hangUpBtn: { backgroundColor: '#F44336', width: 60, height: 60, borderRadius: 30 },
  remoteVideo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  localVideo: { position: 'absolute', top: 50, right: 16, width: 120, height: 160, borderRadius: 12, zIndex: 10 },
  videoTimer: { position: 'absolute', top: 50, left: 0, right: 0, alignItems: 'center' },
  videoTimerText: { color: '#fff', fontSize: 16, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  controls: { position: 'absolute', bottom: 50, flexDirection: 'row', alignItems: 'center', gap: 24 },
  ctrlBtn: { alignItems: 'center', padding: 12 },
  ctrlActive: { opacity: 0.5 },
  ctrlText: { fontSize: 28 },
  ctrlLabel: { fontSize: 11, color: '#aaa', marginTop: 4 },
});
