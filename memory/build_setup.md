---
name: build_setup
description: FamBee 빌드 환경 — 개발경로, 서명키, 빌드 명령, ninja 설정
type: project
---

# FamBee 빌드 환경

## 경로 구조
- **개발/빌드**: `C:\Dev\FamBee` (메인)
- **백업**: `05_FamBee\` (Claude Project 안, "백업해줘" 시 동기화)
- **GitHub**: `smbeat82/fambee` (public)

## 서명키 (절대 잃어버리면 안 됨!)
- **파일**: `C:\Dev\FamBee\android\app\fambee-release.keystore`
- **비밀번호**: `fambee2026`
- **alias**: `fambee`
- **같은 키로 서명해야 업데이트 설치 가능** (다른 키 = 설치 거부)

## 빌드 명령
```bash
cd C:\Dev\FamBee\android
./gradlew.bat app:assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
```
- arm64-v8a: 상훈 폰 (S22 Ultra)
- armeabi-v7a: 하연이 폰 (LG V34)
- APK 출력: `android/app/build/outputs/apk/release/app-release.apk`

## 릴리즈 절차
1. app.json version 올리기
2. 빌드
3. `gh release create vX.X.X fambee-vX.X.X.apk`
4. 앱이 자동으로 업데이트 감지

## ninja 설정 (Windows 260자 경로 제한 해결)
- ninja 1.13.2로 교체: `C:\Users\smbea\AppData\Local\Android\Sdk\cmake\3.22.1\bin\ninja.exe`
- 원본 백업: `ninja.exe.bak`
- Windows LongPathsEnabled=1 레지스트리 설정 필요

## android 디렉토리
- .gitignore에서 제외 (git 추적 안 함)
- `npx expo prebuild --clean`으로 재생성
- .cxx junction: `C:\Dev\FamBee\android\app\.cxx` → `C:\b\cxx`

## GH_TOKEN 주의
- 환경변수 GH_TOKEN이 만료된 토큰으로 설정되어있음
- git push 시 `GH_TOKEN=` 접두사로 비워야 함
- 또는 환경변수 자체를 삭제
