import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// 앱이 포그라운드일 때도 알림 표시
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// 푸시 토큰 등록 → Firestore에 저장
export async function registerPushToken(userId) {
  if (!Device.isDevice) {
    console.log('푸시 알림: 실제 기기에서만 작동');
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('푸시 알림 권한 거부됨');
    return null;
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

    // Firestore에 토큰 저장
    const { db } = require('./firebase');
    const { doc, setDoc } = require('firebase/firestore');
    await setDoc(doc(db, 'pushTokens', userId), {
      token,
      updatedAt: new Date(),
    });

    console.log('푸시 토큰 등록:', token);
    return token;
  } catch (e) {
    console.log('푸시 토큰 등록 실패:', e.message);
    return null;
  }
}

// 상대방에게 푸시 알림 보내기
export async function sendPushToUser(toUserId, title, body) {
  try {
    const { db } = require('./firebase');
    const { doc, getDoc } = require('firebase/firestore');
    const snap = await getDoc(doc(db, 'pushTokens', toUserId));

    if (!snap.exists()) return;
    const { token } = snap.data();

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: token,
        title,
        body,
        sound: 'default',
      }),
    });
  } catch (e) {
    console.log('푸시 알림 전송 실패:', e.message);
  }
}

// 여러 명에게 보내기 (그룹 채팅용)
export async function sendPushToUsers(userIds, senderId, senderName, messageText) {
  for (const userId of userIds) {
    if (userId === senderId) continue;
    await sendPushToUser(userId, senderName, messageText);
  }
}
