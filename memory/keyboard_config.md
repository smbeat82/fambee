---
name: keyboard_config
description: 키보드 처리 — 상훈폰(API36)과 하연이폰(API29) 분기 설정값
type: project
---

# 키보드 처리 — 폰별 분기 (절대 건들지 말 것!)

## 핵심: Platform.Version으로 분기
- `isLegacy = parseInt(Platform.Version, 10) < 35`
- API 35+ (상훈 폰): 시스템 리사이즈에 맡김
- API <35 (하연이 폰): KeyboardStickyView + 수동 처리

## 상훈 폰 (SM-S908N, Android 16, API 36)
- **시스템 리사이즈**: 작동 O (키보드 올라오면 화면 줄어듦)
- **insets.bottom**: 키보드 OFF=48, ON=0 (자동 변경)
- **spacer**: `insets.bottom`만 (시스템이 키보드 처리)
- **FlatList**: marginBottom 없음, paddingBottom 8
- **edgeToEdgeEnabled**: true (false로 하면 호환 경고)

## 하연이 폰 (V340U, Android 10, API 29)
- **시스템 리사이즈**: 작동 X (화면 크기 불변, W=672 고정)
- **insets.bottom**: 항상 48 (키보드 ON/OFF 무관)
- **입력창**: KeyboardStickyView offset: { closed: 0, opened: 50 }
- **FlatList marginBottom**: 키보드 ON → kbH(255), OFF → 없음
- **FlatList paddingBottom**: 키보드 ON → 0, OFF → 60
- **Keyboard listener**: legacy에서만 활성화 (keyboardDidShow/Hide)

## 디버깅 방법 (나중에 다른 폰 추가 시)
1. 헤더에 `W:{winH} KB:{kbH} I:{insets.bottom} V:{Platform.Version}` 표시
2. 키보드 OFF/ON 각각 값 확인
3. W가 변하면 시스템 리사이즈 작동 → 상훈폰 방식
4. W가 안 변하면 수동 처리 필요 → 하연이폰 방식

## 관련 설정 (app.json)
- edgeToEdgeEnabled: true
- softwareKeyboardLayoutMode: "resize"
- KeyboardProvider (App.js에서 감싸고 있음)
