---
name: troubleshooting
description: FamBee 개발 중 발생한 에러와 해결법
type: project
---

# FamBee 트러블슈팅

## 1. Android 키보드가 입력창 가림
- **문제**: Expo Go에서 키보드 올라오면 입력창이 안 올라옴
- **원인**: Expo Go는 app.json의 softwareKeyboardLayoutMode 무시 + Android 15부터 adjustResize 작동 안 함
- **해결**: Expo Go 대신 `npx expo run:android`로 development build 사용
- **시도했지만 안 된 것**: KeyboardAvoidingView, Keyboard.addListener, react-native-keyboard-controller, expo-android-keyboard-fix (전부 Expo Go에서 안 먹음)

## 2. Android 에뮬레이터 창이 안 보임
- **문제**: 에뮬레이터 실행되지만 화면에 창이 안 뜸 (작업표시줄에 아이콘만 보임)
- **원인**: Windows 고해상도 DPI 스케일링 문제
- **해결**: `C:\Users\smbea\AppData\Local\Android\Sdk\emulator\qemu-system-x86_64.exe` → 우클릭 → 속성 → 호환성 → DPI 설정을 "응용프로그램"에서 "시스템"으로 변경

## 3. npx expo run:android 아무 반응 없음
- **문제**: 명령 실행 후 아무 출력 없이 종료
- **원인**: ANDROID_HOME, JAVA_HOME 환경변수 미설정
- **해결**: 
  ```
  setx ANDROID_HOME "C:\Users\smbea\AppData\Local\Android\Sdk"
  setx JAVA_HOME "C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot"
  ```
  설정 후 터미널 새로 열기

## 4. Gradle 빌드 한글 경로 에러
- **문제**: `바탕 화면` 한글 경로를 Gradle이 못 읽음 → 플러그인 resolve 실패
- **원인**: Gradle이 한글/유니코드 경로를 제대로 처리 못 함
- **해결**: 프로젝트를 영문 경로로 이동 (`C:\Dev\FamBee`)
- **개발 끝나면**: 다시 `05_FamBee` 폴더로 복사

## 5. Expo Go tunnel 모드 느림/연결 안 됨
- **문제**: 비행기 WiFi 등 느린 네트워크에서 Expo Go 번들링 안 됨
- **해결**: 웹 모드(`npx expo start --web`)로 UI 확인, 폰 테스트는 안정적 WiFi에서

## 환경 정보
- Windows 11, Intel Iris Xe Graphics
- Android Studio (winget 설치)
- JDK 17 (Microsoft OpenJDK)
- Expo SDK 54, React Native
- 에뮬레이터: Pixel 6 Pro, API 36
