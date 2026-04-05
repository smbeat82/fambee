import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
} from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ],
};

let peerConnection = null;
let localStream = null;
let remoteStream = null;

// 미디어 스트림 가져오기
export async function getMediaStream(isVideo = false) {
  const stream = await mediaDevices.getUserMedia({
    audio: true,
    video: isVideo ? { facingMode: 'user', width: 640, height: 480 } : false,
  });
  localStream = stream;
  return stream;
}

// InCallManager 시작 (오디오 라우팅)
export function startInCallManager(isVideo) {
  InCallManager.start({ media: isVideo ? 'video' : 'audio' });
  InCallManager.setSpeakerphoneOn(isVideo);
  InCallManager.setForceSpeakerphoneOn(isVideo);
}

export function stopInCallManager() {
  InCallManager.stop();
}

// PeerConnection 생성
export function createPeerConnection(onRemoteStream, onIceCandidate, onConnected) {
  peerConnection = new RTCPeerConnection(ICE_SERVERS);

  // 로컬 스트림 추가
  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  }

  // 리모트 스트림 수신 (ontrack — 신규 API)
  peerConnection.ontrack = (event) => {
    if (event.streams && event.streams[0]) {
      remoteStream = event.streams[0];
      onRemoteStream(remoteStream);
    }
  };

  // 리모트 스트림 수신 (onaddstream — 구 API, 호환성 보장)
  peerConnection.onaddstream = (event) => {
    if (event.stream) {
      remoteStream = event.stream;
      onRemoteStream(remoteStream);
    }
  };

  // ICE 후보 발견
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate(event.candidate.toJSON());
    }
  };

  peerConnection.oniceconnectionstatechange = () => {
    const state = peerConnection?.iceConnectionState;
    console.log('ICE 상태:', state);
    if (state === 'connected' || state === 'completed') {
      onConnected?.();
    }
  };

  return peerConnection;
}

// Offer 생성 (발신자)
export async function createOffer() {
  const offer = await peerConnection.createOffer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: true,
  });
  await peerConnection.setLocalDescription(offer);
  return { type: offer.type, sdp: offer.sdp };
}

// Answer 생성 (수신자)
export async function createAnswer(offer) {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  return { type: answer.type, sdp: answer.sdp };
}

// Answer 설정 (발신자가 수신자의 answer 받았을 때)
export async function setAnswer(answer) {
  if (peerConnection && !peerConnection.remoteDescription) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }
}

// ICE 후보 추가
export async function addIceCandidate(candidate) {
  if (peerConnection && peerConnection.remoteDescription) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }
}

// 통화 종료
export function endCall() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  remoteStream = null;
  stopInCallManager();
}

// 마이크 음소거 토글
export function toggleMute() {
  if (!localStream) return false;
  const audioTrack = localStream.getAudioTracks()[0];
  if (audioTrack) {
    audioTrack.enabled = !audioTrack.enabled;
    return !audioTrack.enabled;
  }
  return false;
}

// 카메라 전환 (전면/후면)
export function switchCamera() {
  if (!localStream) return;
  const videoTrack = localStream.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack._switchCamera();
  }
}

// 영상 ON/OFF 토글
export function toggleVideo() {
  if (!localStream) return false;
  const videoTrack = localStream.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.enabled = !videoTrack.enabled;
    return !videoTrack.enabled;
  }
  return false;
}
