// ═══════════════════════════════════════════════════════════
// FIRESTORE RULES
// Firebase Console → Firestore Database → Rules → Replace & Publish
// ═══════════════════════════════════════════════════════════
/*
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
*/

// ═══════════════════════════════════════════════════════════
// STORAGE RULES
// Firebase Console → Storage → Rules → Replace & Publish
// ═══════════════════════════════════════════════════════════
/*
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
*/
