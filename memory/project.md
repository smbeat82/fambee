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
- 상훈 (아빠) — Android (S22 Ultra, arm64-v8a)
- 와이프 — iOS (아이폰)
- 하연이 (딸) — Android (LG V34, armeabi-v7a)

## 기술 스택
- React Native + Expo SDK 54 — Android 빌드
- Firebase — 실시간 DB + 푸시 알림 + Storage
- JS 기반 (상훈이 기존 경험 활용)

## 상태
- v1.1.1 — Phase 3 완료 + 설정 기능 + 자동 업데이트
- **메인 개발 경로**: `C:\Dev\FamBee` (Gradle 한글 경로 문제로 이동)
- **백업 경로**: `05_FamBee\` (백업 시 C:\Dev\FamBee → 여기로 동기화)
- **GitHub**: `smbeat82/fambee` (public)
- 빌드/개발은 항상 `C:\Dev\FamBee`에서 수행
- 빌드: `./gradlew.bat app:assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a`

## 다음 할 일
- Phase 5: 보이스톡/영상통화 (WebRTC + Firebase 시그널링)
- Firebase Storage 규칙 만료일 갱신 (2026-05-05)

## 완료된 Phase
- Phase 1: 채팅 기본기 (시간/날짜/그룹핑/수정/삭제/타이핑)
- Phase 2: 탭 네비게이션, 채팅 목록, 1:1 채팅, 읽음 표시, 프로필 편집
- Phase 3: 푸시 알림 (FCM V1 + Expo Push), 이미지/영상 전송, 이모지 피커
- v1.1.0: 자동 업데이트 체크 (GitHub Releases), 동적 버전 표시
- v1.1.1: 알림 설정, 채팅방 배경색 선택, 채팅목록 버그 수정
