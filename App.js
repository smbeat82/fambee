import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, Alert, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProfileScreen from './src/ProfileScreen';
import ChatListScreen from './src/ChatListScreen';
import ChatScreen from './src/ChatScreen';
import FamilyScreen from './src/FamilyScreen';
import SettingsScreen from './src/SettingsScreen';
import CallScreen from './src/CallScreen';
import { registerPushToken } from './src/notifications';

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

// 탭 네비게이션 (가족 / 채팅목록 / 설정)
function MainTabs({ profile, onLogout, chatBg, onChangeBg }) {
  return (
    <Tab.Navigator
      initialRouteName="채팅"
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#FFF8E1', borderTopColor: '#eee', paddingTop: 4 },
        tabBarActiveTintColor: '#FFA000',
        tabBarInactiveTintColor: '#999',
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="가족"
        options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>👨‍👩‍👧</Text> }}
      >
        {(props) => <FamilyScreen {...props} profile={profile} />}
      </Tab.Screen>
      <Tab.Screen
        name="채팅"
        options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>💬</Text> }}
      >
        {(props) => <ChatListScreen {...props} profile={profile} />}
      </Tab.Screen>
      <Tab.Screen
        name="설정"
        options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>⚙️</Text> }}
      >
        {() => <SettingsScreen profile={profile} onLogout={onLogout} chatBg={chatBg} onChangeBg={onChangeBg} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

// 루트: 탭(하단바 있음) → 채팅방(하단바 없음, 전체화면)
function RootNavigator({ profile, onLogout, chatBg, onChangeBg, navRef }) {

  // 수신 전화 감지
  useEffect(() => {
    if (!profile) return;
    const { db } = require('./src/firebase');
    const { collection, query, where, onSnapshot } = require('firebase/firestore');
    const q = query(collection(db, 'calls'), where('calleeId', '==', profile.id), where('status', '==', 'ringing'));
    const unsub = onSnapshot(q, (snap) => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const call = change.doc.data();
          navRef.current?.navigate('Call', {
            callId: change.doc.id,
            callerId: call.callerId,
            isIncoming: true,
            isVideo: call.type === 'video',
          });
        }
      });
    });
    return () => unsub();
  }, [profile]);

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Main">
        {() => <MainTabs profile={profile} onLogout={onLogout} chatBg={chatBg} onChangeBg={onChangeBg} />}
      </RootStack.Screen>
      <RootStack.Screen name="Chat">
        {(props) => <ChatScreen {...props} profile={profile} chatBg={chatBg} />}
      </RootStack.Screen>
      <RootStack.Screen name="Call">
        {(props) => <CallScreen {...props} profile={profile} />}
      </RootStack.Screen>
    </RootStack.Navigator>
  );
}

export default function App() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chatBg, setChatBg] = useState('#FFF8E1');
  const navRef = React.useRef();

  useEffect(() => {
    AsyncStorage.getItem('fambee_profile').then(data => {
      if (data) {
        const p = JSON.parse(data);
        setProfile(p);
        registerPushToken(p.id);
      }
      setLoading(false);
    });
    AsyncStorage.getItem('fambee_chatBg').then(bg => { if (bg) setChatBg(bg); });
    checkForUpdate();
  }, []);

  const handleChangeBg = async (color) => {
    setChatBg(color);
    await AsyncStorage.setItem('fambee_chatBg', color);
  };

  const checkForUpdate = async () => {
    try {
      const res = await fetch('https://api.github.com/repos/smbeat82/fambee/releases/latest');
      if (!res.ok) return;
      const release = await res.json();
      const latest = release.tag_name?.replace('v', '');
      const current = Constants.expoConfig?.version;
      if (!latest || !current) return;
      const isNewer = (a, b) => {
        const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
        for (let i = 0; i < 3; i++) { if ((pa[i]||0) > (pb[i]||0)) return true; if ((pa[i]||0) < (pb[i]||0)) return false; }
        return false;
      };
      if (!isNewer(latest, current)) return;
      const apk = release.assets?.find(a => a.name.endsWith('.apk'));
      Alert.alert(
        '새 버전이 있어요!',
        `v${current} → v${latest}\n${release.name || ''}`,
        [
          { text: '나중에', style: 'cancel' },
          { text: '업데이트', onPress: () => {
            const url = apk?.browser_download_url || release.html_url;
            Linking.openURL(url);
          }},
        ]
      );
    } catch (e) { /* 네트워크 오류 무시 */ }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('fambee_profile');
    setProfile(null);
  };

  if (loading) return (
    <View style={splashStyles.container}>
      <Image source={require('./assets/splash-icon.png')} style={splashStyles.logo} />
      <Text style={splashStyles.title}>FamBee</Text>
      <Text style={splashStyles.sub}>우리 가족 메신저 🐝</Text>
    </View>
  );

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <StatusBar style="dark" />
        {!profile ? (
          <ProfileScreen onSelect={setProfile} />
        ) : (
          <NavigationContainer ref={navRef}>
            <RootNavigator profile={profile} onLogout={handleLogout} chatBg={chatBg} onChangeBg={handleChangeBg} navRef={navRef} />
          </NavigationContainer>
        )}
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

const splashStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFC107', justifyContent: 'center', alignItems: 'center' },
  logo: { width: 140, height: 140, borderRadius: 70 },
  title: { fontSize: 36, fontWeight: 'bold', color: '#333', marginTop: 16, letterSpacing: 2 },
  sub: { fontSize: 15, color: '#666', marginTop: 6 },
});
