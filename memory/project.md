---
name: project
description: FamBee 가족 메신저 — iOS/Android 크로스플랫폼
type: project
---

# FamBee — 가족 메신저

## 목적
- 딸 하연이(아이패드, 전화번호 없음)가 아빠(안드로이드)한테 메시지 보내기
- 전화번호 인증 없이 작동하는 가족 전용 메신저

## 사용자
- 상훈 (아빠) — Android
- 와이프 — iOS (아이폰)
- 하연이 (딸) — iOS (아이패드, WiFi만)

## 기술 스택
- React Native + Expo — iOS/Android 동시 빌드
- Firebase — 실시간 DB + 인증 + 푸시 알림
- JS 기반 (상훈이 기존 경험 활용)

## 상태
- v0.5.0 — Phase 1 완료
- 개발 경로: `C:\Dev\FamBee` (Gradle 한글 경로 문제로 이동)

## 구현 완료 (Phase 1)
- ProfileScreen — 프로필 선택 (가족 구성원, AsyncStorage 자동 로그인)
- ChatScreen — 실시간 채팅 (Firestore)
- 시간 표시 (오후 3:42), 날짜 구분선
- 연속 메시지 그룹핑, 말풍선 꼬리
- 메시지 길게 누르기 → 복사/수정/삭제 메뉴 (Modal)
- 메시지 수정 ("수정됨" 표시) + 삭제 ("삭제된 메시지입니다")
- 타이핑 인디케이터 ("○○님이 입력 중...")
- 키보드 처리 — Android 버전별 분기 (API 35+ vs <35)
- 앱 아이콘/스플래시 교체 (꿀벌 캐릭터)
- 패키지: com.fambee.chat, edgeToEdgeEnabled: true

## 다음 할 일
- Phase 4: 답장(메시지 인용), 채팅방 배경, 스플래시 텍스트 추가
- Phase 5: 영상 전송 (압축 필요), 보이스톡/영상통화 (WebRTC)
- 배포: Android APK (EAS Build), iOS (Apple Developer)
- Firebase Storage 규칙 만료일 갱신 (2026-05-05)

## 완료된 Phase
- Phase 1: 채팅 기본기 (시간/날짜/그룹핑/수정/삭제/타이핑)
- Phase 2: 탭 네비게이션, 채팅 목록, 1:1 채팅, 읽음 표시, 프로필 편집
- Phase 3: 푸시 알림 (FCM V1 + Expo Push), 이미지 전송 (Firebase Storage + 전체화면뷰어 + 갤러리저장)
