# 05. Deployment Guide

**PRD**: 0001-mad-web-dashboard
**Version**: 2.0 (Browser Automation)
**Last Updated**: 2025-12-18

---

## 1. Deployment Overview

### 1.1 Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Desktop Application Distribution                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         Build Process                                │    │
│  │                                                                      │    │
│  │   Source Code ──► Vite Build ──► Electron Builder ──► Installers   │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                    ┌───────────────┼───────────────┐                        │
│                    ▼               ▼               ▼                        │
│             ┌───────────┐   ┌───────────┐   ┌───────────┐                  │
│             │  Windows  │   │   macOS   │   │   Linux   │                  │
│             │  .exe     │   │  .dmg     │   │  .AppImage│                  │
│             │  .msi     │   │  .pkg     │   │  .deb     │                  │
│             └───────────┘   └───────────┘   └───────────┘                  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      Auto Update (Optional)                          │    │
│  │                                                                      │    │
│  │   User's App ──► Check GitHub Releases ──► Download & Install       │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Deployment Options

| Option | Description | Complexity | Use Case |
|--------|-------------|------------|----------|
| **npm run dev** | 개발 서버 | 낮음 | 개발/테스트 |
| **npm run build** | 로컬 빌드 | 중간 | 개인 사용 |
| **Installer** | 플랫폼별 설치 파일 | 중간 | 배포 |
| **Auto Update** | GitHub 릴리즈 기반 | 높음 | 프로덕션 |

---

## 2. Development Setup

### 2.1 Prerequisites

```bash
# 필수 소프트웨어
- Node.js 20+ (LTS)
- npm 10+ 또는 pnpm 8+

# 확인 명령
node --version    # v20.x.x 이상
npm --version     # 10.x.x 이상
```

### 2.2 Quick Start

```bash
# 1. 저장소 클론
git clone https://github.com/garimto81/mad_framework.git
cd mad_framework/desktop

# 2. 의존성 설치
npm install

# 3. 개발 서버 시작
npm run dev

# 개발 모드로 Electron 앱이 실행됩니다
```

### 2.3 Project Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build && electron-builder",
    "build:win": "vite build && electron-builder --win",
    "build:mac": "vite build && electron-builder --mac",
    "build:linux": "vite build && electron-builder --linux",
    "preview": "vite build && electron .",
    "test": "vitest",
    "lint": "eslint . --ext .ts,.tsx"
  }
}
```

---

## 3. Build Configuration

### 3.1 Electron Builder Config

```json
// electron-builder.json
{
  "$schema": "https://raw.githubusercontent.com/electron-userland/electron-builder/master/packages/app-builder-lib/scheme.json",
  "appId": "com.mad.desktop",
  "productName": "MAD Desktop",
  "directories": {
    "output": "release",
    "buildResources": "build"
  },
  "files": [
    "dist/**/*",
    "node_modules/**/*",
    "package.json"
  ],
  "extraResources": [
    {
      "from": "resources/",
      "to": "resources/"
    }
  ],
  "win": {
    "target": [
      {
        "target": "nsis",
        "arch": ["x64"]
      },
      {
        "target": "portable",
        "arch": ["x64"]
      }
    ],
    "icon": "build/icon.ico"
  },
  "mac": {
    "target": [
      {
        "target": "dmg",
        "arch": ["x64", "arm64"]
      }
    ],
    "icon": "build/icon.icns",
    "category": "public.app-category.productivity"
  },
  "linux": {
    "target": [
      {
        "target": "AppImage",
        "arch": ["x64"]
      },
      {
        "target": "deb",
        "arch": ["x64"]
      }
    ],
    "icon": "build/icons",
    "category": "Utility"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true
  }
}
```

### 3.2 Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'desktop/electron/main.ts',
        onstart(options) {
          options.startup();
        },
        vite: {
          build: {
            outDir: 'dist/main',
            rollupOptions: {
              external: ['better-sqlite3']
            }
          }
        }
      },
      {
        entry: 'desktop/electron/preload.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist/preload'
          }
        }
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'desktop/renderer'),
      '@electron': path.resolve(__dirname, 'desktop/electron'),
      '@shared': path.resolve(__dirname, 'desktop/shared')
    }
  },
  build: {
    outDir: 'dist/renderer'
  }
});
```

---

## 4. Platform-Specific Builds

### 4.1 Windows Build

```bash
# Windows에서 실행
npm run build:win

# 출력 파일
release/
├── MAD Desktop Setup 1.0.0.exe     # NSIS 설치 파일
└── MAD Desktop 1.0.0.exe           # Portable 버전
```

### 4.2 macOS Build

```bash
# macOS에서 실행
npm run build:mac

# 출력 파일
release/
├── MAD Desktop-1.0.0.dmg           # DMG 이미지
├── MAD Desktop-1.0.0-arm64.dmg     # Apple Silicon
└── MAD Desktop-1.0.0-x64.dmg       # Intel Mac
```

### 4.3 Linux Build

```bash
# Linux에서 실행
npm run build:linux

# 출력 파일
release/
├── MAD-Desktop-1.0.0.AppImage      # Universal
└── mad-desktop_1.0.0_amd64.deb     # Debian/Ubuntu
```

---

## 5. Native Dependencies

### 5.1 better-sqlite3 Rebuild

```bash
# Native 모듈 재빌드 (Electron 버전에 맞게)
npx electron-rebuild

# 또는 package.json에 postinstall 추가
{
  "scripts": {
    "postinstall": "electron-builder install-app-deps"
  }
}
```

### 5.2 Platform-Specific Dependencies

```json
// package.json
{
  "optionalDependencies": {
    "better-sqlite3-win32-x64-msvc": "9.2.2",
    "better-sqlite3-darwin-x64": "9.2.2",
    "better-sqlite3-darwin-arm64": "9.2.2",
    "better-sqlite3-linux-x64-gnu": "9.2.2"
  }
}
```

---

## 6. Auto Update Setup

### 6.1 electron-updater Configuration

```typescript
// desktop/electron/core/auto-updater.ts
import { autoUpdater } from 'electron-updater';
import { dialog, BrowserWindow } from 'electron';

export class AutoUpdater {
  private mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    this.setupUpdater();
  }

  private setupUpdater() {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
      dialog.showMessageBox(this.mainWindow, {
        type: 'info',
        title: '업데이트 가능',
        message: `새 버전 ${info.version}이 있습니다. 다운로드하시겠습니까?`,
        buttons: ['다운로드', '나중에']
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.downloadUpdate();
        }
      });
    });

    autoUpdater.on('update-downloaded', () => {
      dialog.showMessageBox(this.mainWindow, {
        type: 'info',
        title: '업데이트 준비 완료',
        message: '업데이트가 다운로드되었습니다. 앱을 재시작하시겠습니까?',
        buttons: ['재시작', '나중에']
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    });
  }

  checkForUpdates() {
    autoUpdater.checkForUpdates();
  }
}
```

### 6.2 GitHub Releases Configuration

```json
// electron-builder.json (추가)
{
  "publish": {
    "provider": "github",
    "owner": "garimto81",
    "repo": "mad_framework",
    "releaseType": "release"
  }
}
```

### 6.3 Release Workflow

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      - name: Build and Release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: npm run build

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: release-${{ matrix.os }}
          path: release/*
```

---

## 7. Code Signing

### 7.1 Windows Code Signing

```bash
# 환경 변수 설정
export CSC_LINK=path/to/certificate.pfx
export CSC_KEY_PASSWORD=your-password

# 빌드
npm run build:win
```

### 7.2 macOS Notarization

```bash
# 환경 변수 설정
export APPLE_ID=your-apple-id@example.com
export APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
export APPLE_TEAM_ID=XXXXXXXXXX

# electron-builder.json 추가
{
  "mac": {
    "hardenedRuntime": true,
    "gatekeeperAssess": false,
    "entitlements": "build/entitlements.mac.plist",
    "entitlementsInherit": "build/entitlements.mac.plist"
  },
  "afterSign": "scripts/notarize.js"
}
```

```javascript
// scripts/notarize.js
const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') return;

  const appName = context.packager.appInfo.productFilename;

  return await notarize({
    appBundleId: 'com.mad.desktop',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID
  });
};
```

---

## 8. Troubleshooting

### 8.1 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| BrowserView 빈 화면 | 세션 문제 | 세션 파티션 확인, 쿠키 초기화 |
| Native 모듈 오류 | Electron 버전 불일치 | `electron-rebuild` 실행 |
| 빌드 실패 | 의존성 문제 | `node_modules` 삭제 후 재설치 |
| 업데이트 실패 | 서명 문제 | 코드 서명 확인 |
| 메모리 누수 | BrowserView 미정리 | destroy() 호출 확인 |

### 8.2 Debug Mode

```bash
# Debug 로깅 활성화
export DEBUG=electron-builder
npm run build

# Electron DevTools 활성화
# main.ts에서
if (process.env.NODE_ENV === 'development') {
  mainWindow.webContents.openDevTools();
}
```

### 8.3 Logs Location

```
Windows: %APPDATA%\MAD Desktop\logs\
macOS:   ~/Library/Logs/MAD Desktop/
Linux:   ~/.config/MAD Desktop/logs/
```

---

## 9. Version Management

### 9.1 Semantic Versioning

```json
// package.json
{
  "version": "1.0.0"
}

// 버전 업데이트
npm version patch  # 1.0.0 → 1.0.1
npm version minor  # 1.0.0 → 1.1.0
npm version major  # 1.0.0 → 2.0.0
```

### 9.2 Release Checklist

- [ ] 모든 테스트 통과
- [ ] CHANGELOG.md 업데이트
- [ ] 버전 번호 업데이트
- [ ] Git 태그 생성
- [ ] 빌드 아티팩트 생성
- [ ] GitHub Release 생성
- [ ] 배포 확인

---

## 10. Quick Reference

### 10.1 Commands Summary

```bash
# 개발
npm run dev              # 개발 서버 시작

# 빌드
npm run build            # 전체 빌드
npm run build:win        # Windows 빌드
npm run build:mac        # macOS 빌드
npm run build:linux      # Linux 빌드

# 테스트
npm run test             # 테스트 실행
npm run test:e2e         # E2E 테스트

# 유틸리티
npm run lint             # 린트 검사
npx electron-rebuild     # Native 모듈 재빌드
```

### 10.2 Output Locations

| Build | Location |
|-------|----------|
| Development | memory (HMR) |
| Production | dist/ |
| Installers | release/ |
| Logs | platform-specific |

---

## References

- [Electron Documentation](https://www.electronjs.org/docs)
- [Electron Builder](https://www.electron.build/)
- [Electron Updater](https://www.electron.build/auto-update)
- [Vite Electron Plugin](https://github.com/electron-vite/vite-plugin-electron)
- [Code Signing](https://www.electron.build/code-signing)
