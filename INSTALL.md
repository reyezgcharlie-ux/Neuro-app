# NEURØ — Installation Guide

## Prerequisites
- Node.js LTS → https://nodejs.org (download & install)
- A Firebase account → https://console.firebase.google.com

---

## Step 1 — Firebase Setup

1. Go to https://console.firebase.google.com
2. **Create project** → name it `neuro-music` → disable Analytics (optional)
3. **Authentication** → Get started → Email/Password → Enable → Save
4. **Firestore Database** → Create database → Start in **test mode** → us-central1
5. **Storage** → Get started → Start in test mode
6. **Project Settings** (gear icon) → Your apps → Add app (</> web icon)
   - App nickname: `neuro-web`
   - Copy the `firebaseConfig` object shown

---

## Step 2 — Paste Your Firebase Config

Open `src/lib/firebase.js` and replace the placeholder values:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",           // ← paste yours
  authDomain: "neuro-music.firebaseapp.com",
  projectId: "neuro-music",
  storageBucket: "neuro-music.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123...",
};
```

---

## Step 3 — Firebase Security Rules

### Firestore Rules
Firebase Console → Firestore → **Rules** tab → replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read: if true;
      allow create: if request.auth.uid == uid;
      allow update: if request.auth.uid == uid;
    }
    match /tracks/{trackId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth != null &&
        (request.auth.uid == resource.data.artistId ||
         request.resource.data.diff(resource.data).affectedKeys()
           .hasOnly(['plays','likes']));
      allow delete: if request.auth.uid == resource.data.artistId;
    }
    match /likes/{likeId} {
      allow read: if true;
      allow write: if request.auth != null;
      allow delete: if request.auth != null;
    }
    match /follows/{followId} {
      allow read: if true;
      allow write: if request.auth != null &&
        request.auth.uid == request.resource.data.followerId;
      allow delete: if request.auth != null;
    }
  }
}
```

### Storage Rules
Firebase Console → Storage → **Rules** tab → replace with:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /avatars/{uid}/{file} {
      allow read: if true;
      allow write: if request.auth.uid == uid
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }
    match /tracks/{uid}/{file} {
      allow read: if true;
      allow write: if request.auth.uid == uid
        && request.resource.size < 50 * 1024 * 1024;
      allow delete: if request.auth.uid == uid;
    }
    match /covers/{uid}/{file} {
      allow read: if true;
      allow write: if request.auth.uid == uid
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
      allow delete: if request.auth.uid == uid;
    }
  }
}
```

Click **Publish** on both.

---

## Step 4 — Install & Run

Open terminal in the `neuro-app` folder:

```bash
npm install
npm run dev
```

Open http://localhost:5173 → create an account → start uploading!

---

## Step 5 — Deploy to Vercel (free)

```bash
npm install -g vercel
vercel
```

Follow prompts → get a live URL instantly.

Or connect your GitHub repo at https://vercel.com for auto-deploy on every push.

---

## Firestore Collections (auto-created on first use)

| Collection | Document | Fields |
|------------|----------|--------|
| `users` | `{uid}` | name, email, avatarUrl, followers, following, tracksCount |
| `tracks` | `{auto}` | title, genre, aiTool, tags, audioUrl, coverUrl, artistId, artistName, plays, likes |
| `likes` | `{uid}_{trackId}` | userId, trackId |
| `follows` | `{uid}_{artistId}` | followerId, followingId |

---

## Contact
admin@synapt.live
