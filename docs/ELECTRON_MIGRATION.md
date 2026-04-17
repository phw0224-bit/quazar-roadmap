# Electron 데스크탑 앱 전환 — 상세 구현 계획

## Context

현재 `React(Vite) + Express` 이원 구조 웹앱을 **내장 서버형 Electron 데스크탑 앱**으로 확장한다.  
핵심 전략: Express가 `dist/` 정적 파일도 서빙하도록 확장하고, Electron BrowserWindow가 `http://localhost:3001`을 로드.  
이렇게 하면 `file://` 프로토콜 이슈(상대 경로 깨짐, null origin 등)를 피하고 기존 API 상대 경로(`/api/*`, `/upload/*`)가 그대로 동작한다.

---

## 코드베이스 현황

| 파일 | 핵심 사실 |
|------|-----------|
| `server/index.js` | CORS 3개 origin 하드코딩, PORT=3001 |
| `server/lib/config.js` | `.env` 로드, `APP_BASE_URL` 기본값 = `http://localhost:5173` |
| `server/routes/upload.js` | `UPLOAD_DIR = <root>/public/uploads/`, 반환 URL = 상대경로 |
| `src/lib/supabase.js` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` |
| `src/api/kanbanAPI.js` | `API_SERVER_URL = ''` → `/api/notifications/assignments` 상대경로 |
| `src/api/fileAPI.js` | `FILE_SERVER_URL = ''` → 상대경로 업로드 |
| `src/main.jsx` | `registerSW` (virtual:pwa-register) 조건 없이 호출 중 |
| `vite.config.js` | PWA 플러그인 포함, proxy → localhost:3001 |
| `src/hooks/useAuth.js` | 이메일+비밀번호 전용, OAuth 없음 |

---

## 구현 단계

### Phase 0: 의존성 설치

```bash
yarn add --dev electron electron-builder
```

- `concurrently`, `wait-on`은 이미 설치되어 있음
- `electron-is-dev` 불필요 — `app.isPackaged`로 대체

---

### Phase 1: Express에 정적 파일 서빙 추가

**파일:** `server/index.js`

**변경 1 — CORS origin 확장:**
```js
// 기존
origin: ['http://localhost:5173', 'http://localhost:1234', 'https://roadmap.ai-quazar.uk'],

// 변경 후
origin: [
  'http://localhost:5173',
  'http://localhost:1234',
  'http://localhost:3001',        // Electron 렌더러 (Express 서빙)
  'https://roadmap.ai-quazar.uk',
],
```

**변경 2 — dist 정적 파일 서빙 (API 라우트 등록 이후 최하단에 추가):**
```js
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '..', 'dist');

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}
```

> `if (fs.existsSync)` 조건으로 `dist/` 없는 개발 환경에서는 무해하게 스킵.  
> SPA fallback(`*` 라우트)은 반드시 모든 API 라우트 이후에 위치해야 함.

---

### Phase 2: 업로드 경로 Electron 패키징 대응

**파일:** `server/routes/upload.js` (line 11)

```js
// 기존
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');

// 변경 후
const UPLOAD_DIR = process.env.ELECTRON_UPLOAD_DIR
  ?? path.join(__dirname, '..', '..', 'public', 'uploads');
```

`electron/main.js`에서 패키징 시 환경변수 주입:
```js
if (app.isPackaged) {
  process.env.ELECTRON_UPLOAD_DIR = path.join(app.getPath('userData'), 'uploads');
}
```

> macOS/Windows 패키징 후 `resources/app/` 경로는 읽기 전용.  
> `app.getPath('userData')`는 쓰기 가능한 OS별 표준 경로 (`~/Library/Application Support/` 등).

---

### Phase 3: Electron 메인 프로세스 생성

**신규 파일:** `electron/main.js`

```js
import { app, BrowserWindow, shell } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

if (!isDev) {
  process.env.ELECTRON_UPLOAD_DIR = path.join(app.getPath('userData'), 'uploads');
}

async function startServer() {
  if (!isDev) {
    await import('../server/index.js');
  }
}

async function waitForServer(url, maxMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return;
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`Server did not start within ${maxMs}ms`);
}

let mainWindow;

async function createWindow() {
  if (!isDev) await startServer();
  await waitForServer('http://localhost:3001');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  });

  mainWindow.loadURL('http://localhost:3001');

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) mainWindow.webContents.openDevTools();
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
```

---

### Phase 4: Preload 스크립트 생성

**신규 파일:** `electron/preload.js`

```js
import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('__ELECTRON__', true);
```

> `window.__ELECTRON__` flag를 `src/main.jsx`의 SW 등록 조건에 활용한다.

---

### Phase 5: PWA 서비스 워커 조건부 비활성화

**파일:** `src/main.jsx`

```js
// 변경 후 — Electron에서는 SW 등록 스킵
if (!window.__ELECTRON__) {
  const { registerSW } = await import('virtual:pwa-register');
  // ... 기존 registerSW 로직 그대로
}
```

> Electron의 net 레이어에서 SW 동작이 불안정하고, 데스크탑 앱 특성상 오프라인 지원이 불필요하다.

---

### Phase 6: Vite 빌드 설정 조정

**파일:** `vite.config.js`

변경사항 최소화 — `dist/`를 Express가 서빙하므로 `base: './'` 불필요.

```js
build: {
  outDir: 'dist',
  sourcemap: !process.env.ELECTRON_BUILD,
},
```

PWA 플러그인은 **유지** — 웹 배포용으로 여전히 필요.

---

### Phase 7: APP_BASE_URL 변경

**파일:** `.env` (로컬만, git 미추적)

```env
# 기존
APP_BASE_URL=http://localhost:5173

# 변경 후
APP_BASE_URL=http://localhost:3001
```

> `APP_BASE_URL`은 GitHub App OAuth 콜백 후 리다이렉트 목적지로만 쓰임.  
> 웹 배포 시 `https://roadmap.ai-quazar.uk`로 설정하면 웹도 그대로 동작.

---

### Phase 8: package.json 스크립트 및 electron-builder 설정 추가

**파일:** `package.json`

**`"main"` 필드 및 scripts 추가:**
```json
"main": "electron/main.js",
"scripts": {
  "electron:dev": "concurrently \"yarn dev\" \"yarn server\" \"wait-on http://localhost:5173 && electron .\"",
  "electron:build": "vite build && electron-builder",
  "electron:pack": "electron-builder --dir"
}
```

> `electron:dev`에서는 Vite dev 서버(5173)와 함께 실행. BrowserWindow는 `http://localhost:5173` 로드.  
> 프로덕션 빌드(`electron:build`) 후엔 `dist/`를 Express(:3001)가 서빙.

**electron-builder 설정:**
```json
"build": {
  "appId": "uk.ai-quazar.roadmap",
  "productName": "Quazar Roadmap",
  "asar": true,
  "files": [
    "dist/**/*",
    "electron/**/*",
    "server/**/*",
    "public/uploads/.gitkeep",
    "package.json"
  ],
  "mac": {
    "target": [{ "target": "dmg", "arch": ["arm64", "x64"] }],
    "category": "public.app-category.productivity"
  },
  "win": { "target": "nsis" },
  "linux": { "target": "AppImage" }
}
```

> **주의:** `.env`는 `files`에 포함하지 않는다 — 실 secrets가 배포 바이너리에 포함되면 안 됨.

---

### Phase 9: ESM 호환 확인

`package.json`에 `"type": "module"`이 있어 전체가 ESM. `electron/main.js`도 `import` 사용.  
Electron ≥ 28에서 ESM 네이티브 지원. 호환 문제 발생 시:

```json
// electron/package.json
{ "type": "commonjs" }
```

해당 디렉터리만 CJS로 오버라이드 가능.

---

## 파일 변경 요약

| 파일 | 작업 | 우선순위 |
|------|------|----------|
| `server/index.js` | CORS에 `localhost:3001` 추가 + dist 정적 서빙 | 필수 |
| `server/routes/upload.js` | `ELECTRON_UPLOAD_DIR` env var 지원 추가 | 필수 |
| `src/main.jsx` | `window.__ELECTRON__` 체크로 SW 등록 조건화 | 필수 |
| `package.json` | `"main"` 필드, 스크립트, `build` 설정 추가 | 필수 |
| `electron/main.js` | 신규 생성 | 필수 |
| `electron/preload.js` | 신규 생성 | 필수 |
| `.env` (로컬) | `APP_BASE_URL=http://localhost:3001` 으로 변경 | 높음 |
| `vite.config.js` | sourcemap 설정 추가 | 낮음 |

---

## 개발 순서 권장

1. **Phase 1** — `yarn build && yarn server` → 브라우저에서 `localhost:3001` 동작 확인
2. **Phase 3+4+8** — `electron/` 디렉터리 + `package.json` 설정
3. **Phase 5** — SW 조건화
4. `yarn electron:dev` 실행 → Electron 창 확인
5. **Phase 2+7** — upload dir + `.env`
6. `yarn electron:build` → 패키징 산출물 로컬 실행 테스트

---

## 검증 방법

### 개발 단계
```bash
yarn build && yarn server
# http://localhost:3001 → React 앱 정상 로드, CRUD/업로드/AI 요약 동작 확인

yarn electron:dev
# Electron 창 기동 확인
# DevTools 콘솔 에러 없는지 확인
# SW 등록 시도 로그 없는지 확인
```

### 패키징 단계
```bash
yarn electron:build
# 설치 후 앱 실행 → http://localhost:3001 로드
# userData 경로에 uploads/ 디렉터리 생성 확인
# 파일 업로드 → userData/uploads/<itemId>/ 저장 확인
```

### 회귀 체크
- 웹 배포 (`yarn build && vite preview`) 에서 PWA 동작 유지 확인
- 웹에서 파일 업로드 경로 (`public/uploads/`) 기존대로 동작 확인
- GitHub App OAuth callback → `APP_BASE_URL` 리다이렉트 확인

---

## 1차 범위 제외

- macOS 코드사인 / 공증
- 자동 업데이트 (`electron-updater`)
- 앱스토어 배포 파이프라인
- Electron `safeStorage`를 이용한 secrets 관리
- PWA / Electron 빌드 분리 (별도 Vite mode)
