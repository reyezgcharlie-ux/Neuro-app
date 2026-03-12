import { useState, useEffect, useCallback } from "react";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile,
  GoogleAuthProvider, signInWithPopup,
} from "firebase/auth";
import {
  collection, doc, getDoc, setDoc, deleteDoc, onSnapshot,
  query, orderBy, where, updateDoc, increment, serverTimestamp, limit,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { auth, db, storage } from "../lib/firebase";

// ── AUTH ──────────────────────────────────────────────────────────────────────
export function useAuth() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fallback: if Firebase never responds, stop loading after 8s
    const timeout = setTimeout(() => setLoading(false), 8000);

    const unsub = onAuthStateChanged(auth, async (u) => {
      clearTimeout(timeout);
      try {
        setUser(u);
        if (u) {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) setProfile({ id: snap.id, ...snap.data() });
        } else {
          setProfile(null);
        }
      } catch (e) {
        console.error("Auth profile error:", e);
      } finally {
        setLoading(false);
      }
    }, (err) => {
      console.error("Auth state error:", err);
      clearTimeout(timeout);
      setLoading(false);
    });

    return () => { unsub(); clearTimeout(timeout); };
  }, []);

  const register = async (email, password, artistName, avatarFile) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    let avatarUrl = "";
    if (avatarFile) {
      const r = ref(storage, `avatars/${cred.user.uid}/${avatarFile.name}`);
      await uploadBytesResumable(r, avatarFile);
      avatarUrl = await getDownloadURL(r);
    }
    await updateProfile(cred.user, { displayName: artistName, photoURL: avatarUrl });
    const data = {
      uid: cred.user.uid, name: artistName, email, avatarUrl,
      followers: 0, following: 0, tracksCount: 0, createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, "users", cred.user.uid), data);
    setProfile({ id: cred.user.uid, ...data });
    return cred.user;
  };

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const u = cred.user;
    // Create user doc if first time
    const snap = await getDoc(doc(db, "users", u.uid));
    if (!snap.exists()) {
      const data = {
        uid: u.uid,
        name: u.displayName || "Artist",
        email: u.email,
        avatarUrl: u.photoURL || "",
        followers: 0, following: 0, tracksCount: 0,
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, "users", u.uid), data);
      setProfile({ id: u.uid, ...data });
    } else {
      setProfile({ id: snap.id, ...snap.data() });
    }
    return u;
  };

  const refreshProfile = async () => {
    if (!auth.currentUser) return;
    const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
    if (snap.exists()) setProfile({ id: snap.id, ...snap.data() });
  };

  return { user, profile, loading, register, login, logout, loginWithGoogle, refreshProfile };
}

// ── TRACKS ────────────────────────────────────────────────────────────────────
export function useTracks(genreFilter = "All") {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let q = query(collection(db, "tracks"), orderBy("createdAt", "desc"), limit(60));
    if (genreFilter !== "All")
      q = query(collection(db, "tracks"), where("genre", "==", genreFilter), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setTracks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [genreFilter]);
  return { tracks, loading };
}

export function useArtistTracks(artistId) {
  const [tracks, setTracks] = useState([]);
  useEffect(() => {
    if (!artistId) return;
    const q = query(collection(db, "tracks"), where("artistId", "==", artistId), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) =>
      setTracks(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [artistId]);
  return tracks;
}

// ── UPLOAD ────────────────────────────────────────────────────────────────────
export function useUploadTrack() {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const upload = useCallback(async ({ audioFile, coverFile, title, genre, aiTool, tags, user, profile }) => {
    setUploading(true); setProgress(0); setError("");
    try {
      const uid = user.uid;
      const ts = Date.now();
      // Sanitize filename — removes spaces and special chars that break Storage
      const sanitize = (name) => name.replace(/[^a-zA-Z0-9._-]/g, "_");

      // Upload audio
      const audioRef = ref(storage, `tracks/${uid}/${ts}_${sanitize(audioFile.name)}`);
      const audioTask = uploadBytesResumable(audioRef, audioFile);
      await new Promise((res, rej) => {
        audioTask.on("state_changed",
          (s) => {
            const pct = Math.round((s.bytesTransferred / s.totalBytes) * 75);
            setProgress(pct);
          },
          (err) => { setError(err.message); rej(err); },
          res
        );
      });
      const audioUrl = await getDownloadURL(audioRef);

      // Upload cover
      let coverUrl = "";
      if (coverFile) {
        setProgress(80);
        const covRef = ref(storage, `covers/${uid}/${ts}_${sanitize(coverFile.name)}`);
        const covTask = uploadBytesResumable(covRef, coverFile);
        await new Promise((res, rej) => {
          covTask.on("state_changed", null, rej, res);
        });
        coverUrl = await getDownloadURL(covRef);
      }

      setProgress(92);
      const trackRef = doc(collection(db, "tracks"));
      await setDoc(trackRef, {
        title, genre, aiTool, tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        audioUrl, coverUrl, artistId: uid,
        artistName: profile?.name || user.displayName || "Unknown",
        artistAvatar: profile?.avatarUrl || "",
        plays: 0, likes: 0, createdAt: serverTimestamp(),
      });
      // Use setDoc with merge so it works even if user doc doesn't exist yet
      await setDoc(doc(db, "users", uid), { tracksCount: increment(1) }, { merge: true });
      setProgress(100);
      return trackRef.id;
    } catch (err) {
      setError(err.message || "Upload failed");
      throw err;
    } finally {
      setUploading(false);
    }
  }, []);

  return { upload, progress, uploading, error };
}

// ── EDIT TRACK ────────────────────────────────────────────────────────────────
export async function editTrack(trackId, { title, genre, aiTool, tags, coverFile, artistId }) {
  const updates = { title, genre, aiTool, tags: tags.split(",").map((t) => t.trim()).filter(Boolean) };
  if (coverFile) {
    const r = ref(storage, `covers/${artistId}/${Date.now()}_${coverFile.name}`);
    await uploadBytesResumable(r, coverFile);
    updates.coverUrl = await getDownloadURL(r);
  }
  await updateDoc(doc(db, "tracks", trackId), updates);
}

// ── DELETE TRACK ──────────────────────────────────────────────────────────────
export async function deleteTrack(track, userId) {
  await deleteDoc(doc(db, "tracks", track.id));
  try { if (track.audioUrl) await deleteObject(ref(storage, track.audioUrl)); } catch (_) {}
  try { if (track.coverUrl) await deleteObject(ref(storage, track.coverUrl)); } catch (_) {}
  await updateDoc(doc(db, "users", userId), { tracksCount: increment(-1) });
}

// ── LIKES ─────────────────────────────────────────────────────────────────────
export function useLikes(userId) {
  const [liked, setLiked] = useState(new Set());
  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, "likes"), where("userId", "==", userId));
    const unsub = onSnapshot(q, (snap) =>
      setLiked(new Set(snap.docs.map((d) => d.data().trackId))));
    return unsub;
  }, [userId]);

  const toggleLike = async (track) => {
    if (!userId) return;
    const likeId = `${userId}_${track.id}`;
    const likeRef = doc(db, "likes", likeId);
    const trackRef = doc(db, "tracks", track.id);
    if (liked.has(track.id)) {
      await deleteDoc(likeRef);
      await updateDoc(trackRef, { likes: increment(-1) });
    } else {
      await setDoc(likeRef, { userId, trackId: track.id, createdAt: serverTimestamp() });
      await updateDoc(trackRef, { likes: increment(1) });
    }
  };
  return { liked, toggleLike };
}

// ── FOLLOWS ───────────────────────────────────────────────────────────────────
export function useFollows(userId) {
  const [following, setFollowing] = useState(new Set());
  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, "follows"), where("followerId", "==", userId));
    const unsub = onSnapshot(q, (snap) =>
      setFollowing(new Set(snap.docs.map((d) => d.data().followingId))));
    return unsub;
  }, [userId]);

  const toggleFollow = async (artistId) => {
    if (!userId || userId === artistId) return;
    const followId = `${userId}_${artistId}`;
    const followRef = doc(db, "follows", followId);
    const artistRef = doc(db, "users", artistId);
    const meRef = doc(db, "users", userId);
    if (following.has(artistId)) {
      await deleteDoc(followRef);
      await setDoc(artistRef, { followers: increment(-1) }, { merge: true });
      await setDoc(meRef, { following: increment(-1) }, { merge: true });
    } else {
      await setDoc(followRef, { followerId: userId, followingId: artistId, createdAt: serverTimestamp() });
      await setDoc(artistRef, { followers: increment(1) }, { merge: true });
      await setDoc(meRef, { following: increment(1) }, { merge: true });
    }
  };
  return { following, toggleFollow };
}

// ── ARTISTS ───────────────────────────────────────────────────────────────────
export function useArtists() {
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("followers", "desc"), limit(30));
    const unsub = onSnapshot(q, (snap) => {
      setArtists(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);
  return { artists, loading };
}

// ── PLAY COUNT ────────────────────────────────────────────────────────────────
export async function registerPlay(trackId) {
  try { await updateDoc(doc(db, "tracks", trackId), { plays: increment(1) }); } catch (_) {}
}
