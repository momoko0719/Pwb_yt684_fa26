# Firebase tutorial — Class 04 Clay Studio

**Goal (Assignment 2):** put Clay Studio on a **public URL**, with **login**, and **save / load a configuration** tied to that user.

This is Ella’s own walkthrough for `class_04/react-app-ts`. English first; Chinese tips where it helps.

---

## Big picture — what we actually need

| Service | Plain talk | Like storing… | This Clay Studio site? |
| --- | --- | --- | --- |
| **Authentication** | Who are you? | — | **Yes** — Google sign-in so Save is per user |
| **Firestore** | Cloud database for structured data | Numbers, text, JSON settings | **Yes** — shape, sliders, which station… |
| **Storage** | Cloud folder for **files** | PNG, MP3, video, big binaries | **Not for now** — we don’t upload media |
| **Hosting** | Put the website online | The built `dist/` site | **Yes** — public URL for the spreadsheet |

### Firestore vs Storage (short)

- **Firestore** = database of documents (fields and nested objects). Perfect for “save my clay preset.”  
- **Storage** = file bucket (images, audio, downloads). Use when the app needs real files.

**Decision for this project:** configuration is small JSON → **Firestore only**.  
We **skip Storage** for now because:

1. This webpage has no PNG / MP3 / user-upload assets to store.  
2. New Firebase projects often require a **Blaze (billing)** plan just to turn Storage on.  
3. Save / Load still fully works with Auth + Firestore + Hosting.

If the instructor later requires Storage, see [§4 Optional Storage](#4-storage-optional--skipped-for-now) and flip `USE_STORAGE_BACKUP` in code.

**Save / load flow (current)**

```
Sign in (Auth)
    → Save  → Firestore  users/{uid}/configs/default
    → Load  → read that document → apply settings
```

---

## 0. Prerequisites

- Google account  
- Node.js + npm  
- App folder: `class_04/react-app-ts`

```bash
npm install -g firebase-tools
firebase login
cd class_04/react-app-ts
npm install firebase
```

---

## 1. Create a Firebase project (console)

1. [Firebase Console](https://console.firebase.google.com/) → **Add project** (e.g. `pwb-class04-clay`)  
2. Analytics optional  
3. Add a **Web** app → copy `firebaseConfig`  

### Env file

Create `.env.local` (gitignored via `*.local`):

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=YOUR_PROJECT.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=YOUR_PROJECT.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

`STORAGE_BUCKET` can stay in env even if Storage is off — unused for now.  
Restart `npm run dev` after editing env.  
Set `.firebaserc` → `"default": "your-real-project-id"` (not `YOUR_PROJECT_ID`).

---

## 2. Enable Authentication

**Build → Authentication → Get started**

1. **Google** → Enable  
2. Public-facing name: e.g. `Clay Studio` (optional but nicer)  
3. Support email: your Cornell email  
4. **Authorized domains:** keep `localhost` for local dev  

App: Cloud bar → **Sign in with Google**.

---

## 3. Enable Firestore

**Build → Firestore Database → Create database**

1. Production mode + region near you  
2. Publish rules (below)

### Data shape (written by the app — you do not type this in the console)

```
users/{uid}/configs/default
  {
    version: 1,
    updatedAt: <timestamp>,
    name: "My clay preset",
    config: { ...studio settings... }
  }
```

After you click **Save** once while signed in, this path appears automatically.

### Rules → Publish

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 4. Storage (optional — skipped for now)

**Not enabled on this project yet.**

| Why skip | Detail |
| --- | --- |
| No file assets | Clay Studio only saves preset settings, not images/audio |
| Billing gate | Console often says “upgrade to Blaze” to use Storage |
| Firestore enough | Assignment “save and load a configuration” works on Firestore |

### If you enable Storage later

1. Upgrade to **Blaze** if required (usually $0 within free quotas for tiny JSON).  
2. **Storage → Get started** → rules:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. In code set `USE_STORAGE_BACKUP = true` in `src/lib/cloudConfig.ts` so Save also uploads `users/{uid}/configs/default.json`.

---

## 5. Wire the app (already scaffolded)

| File | Job |
| --- | --- |
| `src/lib/firebase.ts` | Init Auth + Firestore (+ Storage SDK ready but unused) |
| `src/lib/cloudConfig.ts` | Save / load; Storage behind `USE_STORAGE_BACKUP = false` |
| `src/lib/studioConfig.ts` | Configuration shape |
| `src/components/CloudBar.tsx` | Sign in · Save · Load |
| `firebase.json` | Hosting → `dist` |

**Try locally**

```bash
npm run dev
```

1. Sign in with Google  
2. Tweak Station 1  
3. **Save** → Firestore shows `users/.../configs/default`  
4. Change sliders → **Load** → settings return  

---

## 6. Hosting — public website

Folder already has `firebase.json`. **Do not need `firebase init` again** if that file exists.

```bash
firebase use pwb-class04-clay   # your real project id
npm run build
firebase deploy --only hosting
```

Or: `npm run deploy`

URL like `https://pwb-class04-clay.web.app` → paste into the class spreadsheet.

**Auth → Authorized domains** → add the `.web.app` host after first deploy.

---

## 7. Troubleshooting

| Problem | Fix |
| --- | --- |
| `Invalid project id: YOUR_PROJECT_ID` | Fix `.firebaserc` to real id |
| Cloud bar “Firebase not configured” | `.env.local` + restart Vite |
| `auth/unauthorized-domain` | Add domain under Auth settings |
| Permission denied | Publish Firestore rules; stay signed in |
| Storage upgrade wall | Expected — we skip Storage; use Firestore |
| Blank Hosting page | `public` must be `dist`; rebuild before deploy |

---

## 8. Security notes

- Web API keys in the client are normal; **rules** protect data.  
- Never commit Admin / service-account keys.  
- Publish Firestore rules before sharing the URL.

---

## 9. Assignment checklist (this project)

- [x] Own tutorial written (this file)  
- [ ] Authentication enabled (Google)  
- [ ] Firestore enabled + config per user  
- [ ] ~~Storage~~ — **intentionally skipped** (documented above; no media files; Blaze gate)  
- [ ] Hosting deploy → public URL  
- [ ] Save / load configuration while logged in  
- [ ] URL shared on spreadsheet  

If the course **requires** Storage by name, upgrade Blaze + §4, then check that box.

---

## 中文速查

| 服务 | 是什么 | 这个网站要不要 |
| --- | --- | --- |
| Auth | 登录 | 要 |
| Firestore | 存设置/数据（像数据库） | 要 |
| Storage | 存 PNG、MP3 这类**文件** | **先不要**（没上传媒体；开 Storage 常要付费档） |
| Hosting | 网站上线 | 要 |

1. `.env.local` + `.firebaserc` 用真实 project id  
2. 开 Google 登录 + Firestore（规则 Publish）  
3. 本地：登录 → Save → Load  
4. `npm run deploy` → 网址贴表格  
5. Storage 以后若作业强制再开；代码里把 `USE_STORAGE_BACKUP` 改成 `true`  

有问题先看第 7 节。
