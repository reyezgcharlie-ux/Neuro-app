import { useState, useEffect, useRef, useCallback } from "react";
import {
  useAuth, useTracks, useArtistTracks, useUploadTrack,
  editTrack, deleteTrack, useLikes, useFollows, useArtists, registerPlay,
} from "./hooks/useFirebase";

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const GENRES = [
  "Synthwave","Techno","Ambient","Lo-fi","Experimental","Chill","House",
  "Drum & Bass","Hip-Hop","Jazz Fusion","Dark Ambient","Trap","Phonk","Vaporwave",
  "Industrial","Trance","Deep House","Future Bass","Breakbeat","Garage","Neo-Soul",
  "Afrobeats","Latin","Reggaeton","R&B","Shoegaze","Post-Rock","Drone","Noise",
  "Field Recording","Glitch","Dubstep","UK Bass","Hyperpop","Electro",
];
const AI_TOOLS = ["Suno v4","Udio","Stable Audio","MusicGen","AudioCraft","Other"];
const CONTACT_EMAIL = "admin@synapt.live";

// ── GEO COVER (deterministic art for tracks without cover) ────────────────────
function GeoCover({ seed, size = 54, style }) {
  const s = typeof seed === "string"
    ? seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    : seed || 1;
  const hues = [180,200,165,215,260,150,195,175,230,188];
  const h = hues[s % hues.length], h2 = (h + 45) % 360;
  const r = (n) => { let x = Math.sin(s * 9301 + n * 49297 + 233) * 100000; return x - Math.floor(x); };
  const circles = Array.from({ length: 3 }, (_, i) => ({
    cx: (r(i*3) * size).toFixed(1), cy: (r(i*3+1) * size).toFixed(1),
    cr: (r(i*3+2) * size * 0.38 + size * 0.06).toFixed(1), op: (0.05 + r(i) * 0.09).toFixed(2),
  }));
  const lines = Array.from({ length: 5 }, (_, i) => ({
    x1: (r(i*5)*size).toFixed(1), y1: (r(i*5+1)*size).toFixed(1),
    x2: (r(i*5+2)*size).toFixed(1), y2: (r(i*5+3)*size).toFixed(1),
    w: (r(i)*1.4+0.5).toFixed(1), op: (0.1+r(i)*0.16).toFixed(2),
  }));
  const pts = Array.from({ length: 6 }, (_, i) => {
    const ang = (i/6)*Math.PI*2, rad = (0.18+r(i+20)*0.2)*size;
    return `${(size/2+Math.cos(ang)*rad).toFixed(1)},${(size/2+Math.sin(ang)*rad).toFixed(1)}`;
  }).join(" ");
  const cx2 = (size/2+(r(50)-0.5)*size*0.22).toFixed(1);
  const cy2 = (size/2+(r(51)-0.5)*size*0.22).toFixed(1);
  const id = `g${s}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={style}>
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={`hsl(${h},60%,8%)`}/>
          <stop offset="100%" stopColor={`hsl(${h2},55%,15%)`}/>
        </linearGradient>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={`hsl(${h},100%,62%)`} stopOpacity="0.9"/>
          <stop offset="100%" stopColor={`hsl(${h2},100%,52%)`} stopOpacity="0.75"/>
        </linearGradient>
      </defs>
      <rect width={size} height={size} fill={`url(#${id}b)`}/>
      {circles.map((c,i) => <circle key={i} cx={c.cx} cy={c.cy} r={c.cr} fill={`hsl(${h},80%,60%)`} fillOpacity={c.op}/>)}
      {lines.map((l,i) => <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={`hsl(${h},100%,70%)`} strokeWidth={l.w} strokeOpacity={l.op}/>)}
      <polygon points={pts} fill="none" stroke={`url(#${id}a)`} strokeWidth="0.8" strokeOpacity="0.5"/>
      <circle cx={cx2} cy={cy2} r={(size*0.055).toFixed(1)} fill={`url(#${id}a)`} fillOpacity="0.9"/>
    </svg>
  );
}

// ── LOGO ──────────────────────────────────────────────────────────────────────
function Logo({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none"
      style={{ filter: "drop-shadow(0 0 8px rgba(0,255,200,0.6))", flexShrink: 0 }}>
      <polygon points="28,2 52,15 52,41 28,54 4,41 4,15"
        stroke="#00ffc8" strokeWidth="1.8" fill="rgba(0,255,200,0.07)"/>
      <circle cx="28" cy="28" r="4.5" fill="#00ffc8" style={{ filter: "drop-shadow(0 0 6px #00ffc8)" }}/>
      <line x1="28" y1="23" x2="28" y2="4" stroke="#00ffc8" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="2.5 3"/>
      <line x1="24" y1="31" x2="6" y2="40" stroke="#00ffc8" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="2.5 3"/>
      <line x1="32" y1="31" x2="50" y2="40" stroke="#00ffc8" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="2.5 3"/>
    </svg>
  );
}

// ── AVATAR ────────────────────────────────────────────────────────────────────
function Avatar({ src, seed, size = 38, style }) {
  if (src) return <img src={src} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", ...style }}/>;
  return <GeoCover seed={seed} size={size} style={{ borderRadius: "50%", ...style }}/>;
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }, []);
  return { toast, show };
}
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{
      position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
      background: toast.type === "error" ? "rgba(255,68,102,0.12)" : "rgba(0,255,200,0.1)",
      border: `1px solid ${toast.type === "error" ? "rgba(255,68,102,0.4)" : "rgba(0,255,200,0.4)"}`,
      color: toast.type === "error" ? "#ff4466" : "#00ffc8",
      padding: "10px 26px", zIndex: 9999, borderRadius: 8, fontSize: 13, fontWeight: 500,
      backdropFilter: "blur(14px)", whiteSpace: "nowrap",
      animation: "fadeUp .3s ease",
    }}>{toast.msg}</div>
  );
}

// ── TRACK CARD ────────────────────────────────────────────────────────────────
function TrackCard({ track, isOwn, player, setPlayer, liked, onLike, onEdit, onDelete, onArtistClick }) {
  const isPlaying = player?.id === track.id && player?.playing;
  const isActive = player?.id === track.id;

  const handlePlay = () => {
    if (isActive) {
      setPlayer(p => ({ ...p, playing: !p.playing }));
    } else {
      setPlayer({ id: track.id, playing: true, track });
      registerPlay(track.id);
    }
  };

  return (
    <div style={{
      background: "rgba(255,255,255,0.022)", border: `1px solid ${isActive ? "rgba(0,255,200,0.3)" : "rgba(255,255,255,0.07)"}`,
      borderRadius: 10, padding: 16, transition: "all .25s", position: "relative",
      marginBottom: 10,
    }}>
      {isOwn && (
        <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 6, zIndex: 2 }}>
          <button onClick={() => onEdit(track)} style={ownerBtn("#00ffc8")} title="Edit">
            <EditIcon/>
          </button>
          <button onClick={() => onDelete(track)} style={ownerBtn("#ff4466")} title="Delete">
            <TrashIcon/>
          </button>
        </div>
      )}
      <div style={{ display: "flex", gap: 14, marginBottom: 12, paddingRight: isOwn ? 76 : 0 }}>
        <div onClick={handlePlay} style={{ width: 54, height: 54, borderRadius: 8, overflow: "hidden",
          flexShrink: 0, cursor: "pointer", position: "relative",
          border: "1px solid rgba(0,255,200,0.1)" }}>
          {track.coverUrl
            ? <img src={track.coverUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
            : <GeoCover seed={track.id} size={54}/>}
          {isActive && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)",
              display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8 }}>
              {isPlaying ? <PauseIcon size={18}/> : <PlayIcon size={16}/>}
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 2,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.title}</div>
          <span onClick={() => onArtistClick(track.artistId)}
            style={{ fontSize: 12, color: "rgba(255,255,255,0.42)", cursor: "pointer",
              display: "inline-block", marginBottom: 8, transition: "color .2s" }}
            onMouseOver={e => e.target.style.color = "#00ffc8"}
            onMouseOut={e => e.target.style.color = "rgba(255,255,255,0.42)"}>
            {track.artistName}
          </span>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            <span style={tagStyle("neon")}>{track.genre}</span>
            {track.aiTool && <span style={tagStyle("dim")}>{track.aiTool}</span>}
          </div>
        </div>
      </div>
      {/* Waveform bar */}
      <div onClick={handlePlay} style={{ display: "flex", alignItems: "center", gap: 1.5,
        height: 26, cursor: "pointer", marginBottom: 11 }}>
        {Array.from({ length: 30 }, (_, i) => {
          const h = Math.sin(i * 0.7 + (track.id?.charCodeAt?.(0) || i)) * 0.3 + 0.5;
          return <div key={i} style={{
            flex: 1, height: `${h * 100}%`, borderRadius: 2,
            background: isActive ? `rgba(0,255,200,${0.2 + h * 0.8})` : `rgba(255,255,255,${0.04 + h * 0.16})`,
            transition: "background .3s",
          }}/>;
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 14 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.42)" }}>▶ {fmt(track.plays)}</span>
          <button onClick={() => onLike(track)} style={{
            fontSize: 12, color: liked.has(track.id) ? "#ff4466" : "rgba(255,255,255,0.42)",
            background: "none", border: "none", cursor: "pointer", padding: 0,
            fontFamily: "'DM Sans', sans-serif", transition: "color .2s",
          }}>♥ {fmt(track.likes)}</button>
        </div>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.18)" }}>
          {track.tags?.slice(0,2).map(t => `#${t}`).join(" ")}
        </span>
      </div>
    </div>
  );
}

// ── UPLOAD MODAL ──────────────────────────────────────────────────────────────
function UploadModal({ onClose, onSuccess, user, profile }) {
  const { upload, progress, uploading, error: uploadError } = useUploadTrack();
  const [step, setStep] = useState(1);
  const [audioFile, setAudioFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [form, setForm] = useState({ title: "", genre: "", aiTool: "", tags: "" });

  const handleCover = (f) => {
    if (!f) return;
    setCoverFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setCoverPreview(e.target.result);
    reader.readAsDataURL(f);
  };

  const handleSubmit = async () => {
    if (!audioFile || !form.title || !form.genre) return;
    try {
      await upload({ audioFile, coverFile, ...form, user, profile });
      onSuccess();
    } catch (e) {
      // error displayed via uploadError below
    }
  };

  return (
    <Overlay onClose={!uploading ? onClose : null}>
      <div style={{ width: 40, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 4, margin: "0 auto 24px" }}/>
      <div style={{ position: "absolute", top: 14, right: 16 }}>
        {!uploading && <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.42)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>✕</button>}
      </div>
      {/* Step bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
        {[1,2].map(n => <div key={n} style={{ flex: 1, height: 2, borderRadius: 2, background: step >= n ? "#00ffc8" : "rgba(255,255,255,0.08)", transition: "background .3s" }}/>)}
      </div>
      <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 17, fontWeight: 900, color: "#00ffc8", marginBottom: 4 }}>
        {step === 1 ? "UPLOAD TRACK" : "DETAILS"}
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.42)", marginBottom: 24 }}>
        Step {step}/2 — {step === 1 ? "Select your files" : "Track information"}
      </div>

      {step === 1 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Audio */}
          <label style={{ display: "block", cursor: "pointer" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.18)", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 8 }}>AUDIO *</div>
            <div style={{
              display: "flex", alignItems: "center", gap: 16, padding: "18px 20px",
              background: audioFile ? "rgba(0,255,200,0.06)" : "rgba(0,255,200,0.03)",
              border: `1.5px solid ${audioFile ? "#00ffc8" : "rgba(0,255,200,0.22)"}`,
              borderRadius: 12, transition: "all .2s",
            }}>
              <div style={{ width: 48, height: 48, borderRadius: 10, background: "rgba(0,255,200,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00ffc8" strokeWidth="1.6" strokeLinecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: audioFile ? "#00ffc8" : "rgba(255,255,255,0.8)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {audioFile ? audioFile.name : "Tap to select audio"}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.18)" }}>MP3 · WAV · FLAC · Max 50 MB</div>
              </div>
              <span style={{ color: "rgba(0,255,200,0.4)", fontSize: 18 }}>›</span>
            </div>
            <input type="file" accept="audio/*" style={{ display: "none" }}
              onChange={e => setAudioFile(e.target.files[0])}/>
          </label>
          {/* Cover */}
          <label style={{ display: "block", cursor: "pointer" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.18)", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 8 }}>COVER IMAGE</div>
            <div style={{
              display: "flex", alignItems: "center", gap: 16, padding: "18px 20px",
              background: coverFile ? "rgba(0,255,200,0.06)" : "rgba(0,255,200,0.03)",
              border: `1.5px solid ${coverFile ? "#00ffc8" : "rgba(0,255,200,0.22)"}`,
              borderRadius: 12, transition: "all .2s",
            }}>
              <div style={{ width: 48, height: 48, borderRadius: 10, overflow: "hidden", flexShrink: 0,
                background: "rgba(0,255,200,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {coverPreview ? <img src={coverPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/> : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00ffc8" strokeWidth="1.6" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: coverFile ? "#00ffc8" : "rgba(255,255,255,0.8)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {coverFile ? coverFile.name : "Tap to select image"}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.18)" }}>JPG · PNG · WEBP · Square · Max 5 MB</div>
              </div>
              <span style={{ color: "rgba(0,255,200,0.4)", fontSize: 18 }}>›</span>
            </div>
            <input type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => handleCover(e.target.files[0])}/>
          </label>
          <button onClick={() => audioFile && setStep(2)} style={{ ...solidBtn, opacity: audioFile ? 1 : 0.4, marginTop: 4 }}>
            CONTINUE →
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="TITLE *"><input className="inp" style={inp} placeholder="Track name" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}/></Field>
          <Field label="GENRE *">
            <select className="inp" style={inp} value={form.genre} onChange={e => setForm(f => ({ ...f, genre: e.target.value }))}>
              <option value="">Select genre</option>
              {GENRES.map(g => <option key={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="AI TOOL">
            <select className="inp" style={inp} value={form.aiTool} onChange={e => setForm(f => ({ ...f, aiTool: e.target.value }))}>
              <option value="">Select tool</option>
              {AI_TOOLS.map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="TAGS"><input className="inp" style={inp} placeholder="dark, electronic, chill..." value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}/></Field>
          {(uploading || progress > 0) && !uploadError && (
            <div style={{ background: "rgba(0,255,200,0.04)", border: "1px solid rgba(0,255,200,0.2)", borderRadius: 8, padding: "12px 16px" }}>
              <div style={{ fontSize: 12, color: "rgba(0,255,200,0.7)", marginBottom: 8 }}>Uploading... {progress}%</div>
              <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
                <div style={{ height: "100%", width: `${progress}%`, background: "#00ffc8", borderRadius: 2, transition: "width .3s" }}/>
              </div>
            </div>
          )}
          {uploadError && (
            <div style={{ background: "rgba(255,68,102,0.08)", border: "1px solid rgba(255,68,102,0.3)", borderRadius: 8, padding: "12px 16px", fontSize: 12, color: "#ff4466" }}>
              ⚠ {uploadError.includes("storage/unauthorized") ? "Storage permission denied — check Firebase Storage rules." : uploadError}
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button onClick={() => setStep(1)} style={{ ...ghostBtn, flex: 1 }} disabled={uploading}>← Back</button>
            <button onClick={handleSubmit} style={{ ...solidBtn, flex: 2 }} disabled={uploading || !form.title || !form.genre}>
              {uploading ? `UPLOADING ${progress}%` : "PUBLISH"}
            </button>
          </div>
        </div>
      )}
    </Overlay>
  );
}

// ── EDIT MODAL ────────────────────────────────────────────────────────────────
function EditModal({ track, onClose, onSuccess, userId }) {
  const [form, setForm] = useState({
    title: track.title || "", genre: track.genre || "",
    aiTool: track.aiTool || "", tags: track.tags?.join(", ") || "",
  });
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(track.coverUrl || null);
  const [saving, setSaving] = useState(false);

  const handleCover = (f) => {
    setCoverFile(f);
    const r = new FileReader();
    r.onload = (e) => setCoverPreview(e.target.result);
    r.readAsDataURL(f);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await editTrack(track.id, { ...form, coverFile, artistId: userId });
      onSuccess("Track updated!");
    } catch (e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  };

  return (
    <Overlay onClose={!saving ? onClose : null}>
      <div style={{ width: 40, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 4, margin: "0 auto 24px" }}/>
      <div style={{ position: "absolute", top: 14, right: 16 }}>
        {!saving && <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.42)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>✕</button>}
      </div>
      <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 17, fontWeight: 900, color: "#00ffc8", marginBottom: 4 }}>EDIT TRACK</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.42)", marginBottom: 24 }}>Update your track info</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Cover */}
        <label style={{ cursor: "pointer" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.18)", letterSpacing: "1.5px", marginBottom: 8 }}>COVER IMAGE</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
            background: "rgba(0,255,200,0.03)", border: "1.5px solid rgba(0,255,200,0.22)", borderRadius: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
              {coverPreview ? <img src={coverPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
                : <GeoCover seed={track.id} size={48}/>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{coverFile ? coverFile.name : "Tap to change cover"}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>JPG · PNG · WEBP</div>
            </div>
          </div>
          <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleCover(e.target.files[0])}/>
        </label>
        <Field label="TITLE *"><input style={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}/></Field>
        <Field label="GENRE *">
          <select style={inp} value={form.genre} onChange={e => setForm(f => ({ ...f, genre: e.target.value }))}>
            {GENRES.map(g => <option key={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="AI TOOL">
          <select style={inp} value={form.aiTool} onChange={e => setForm(f => ({ ...f, aiTool: e.target.value }))}>
            <option value="">Select tool</option>
            {AI_TOOLS.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="TAGS"><input style={inp} placeholder="dark, electronic..." value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}/></Field>
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button onClick={onClose} style={{ ...ghostBtn, flex: 1 }} disabled={saving}>Cancel</button>
          <button onClick={handleSave} style={{ ...solidBtn, flex: 2 }} disabled={saving}>
            {saving ? "SAVING..." : "SAVE CHANGES"}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

// ── AUTH SCREEN ───────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const { register, login, loginWithGoogle } = useAuth();
  const [tab, setTab] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAvatar = (f) => {
    if (!f) return;
    setAvatarFile(f);
    const r = new FileReader();
    r.onload = (e) => setAvatarPreview(e.target.result);
    r.readAsDataURL(f);
  };

  const handleGoogleLogin = async () => {
    setError(""); setGoogleLoading(true);
    try {
      await loginWithGoogle();
      onAuth();
    } catch (e) {
      setError(e.message.replace("Firebase: ", ""));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError(""); setLoading(true);
    try {
      if (tab === "register") {
        if (!form.name) { setError("Artist name required"); setLoading(false); return; }
        await register(form.email, form.password, form.name, avatarFile);
      } else {
        await login(form.email, form.password);
      }
      onAuth();
    } catch (e) { setError(e.message.replace("Firebase: ", "")); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, background: "#05060c", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "fixed", inset: 0, backgroundImage: "linear-gradient(rgba(0,255,200,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,200,0.018) 1px,transparent 1px)", backgroundSize: "52px 52px", pointerEvents: "none" }}/>
      <div style={{ position: "fixed", top: "12%", left: "5%", width: 340, height: 340, background: "radial-gradient(circle,rgba(0,255,200,0.06),transparent 70%)", borderRadius: "50%", pointerEvents: "none" }}/>
      <div style={{ position: "fixed", bottom: "10%", right: "5%", width: 270, height: 270, background: "radial-gradient(circle,rgba(0,128,255,0.07),transparent 70%)", borderRadius: "50%", pointerEvents: "none" }}/>
      <div style={{ background: "rgba(8,11,20,0.96)", border: "1px solid rgba(0,255,200,0.18)", width: "100%", maxWidth: 400, padding: "40px 32px", borderRadius: 14, position: "relative", zIndex: 1, boxShadow: "0 0 60px rgba(0,255,200,0.06)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Logo size={60}/>
          <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 26, fontWeight: 900, letterSpacing: 8, color: "#00ffc8", textShadow: "0 0 24px rgba(0,255,200,0.55)", marginTop: 14 }}>NEURØ</div>
          <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 9, letterSpacing: 7, color: "rgba(255,255,255,0.22)", marginTop: 5 }}>AI MUSIC PLATFORM</div>
        </div>
        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(0,255,200,0.1)", marginBottom: 22 }}>
          {["login","register"].map(t => (
            <button key={t} onClick={() => { setTab(t); setError(""); }} style={{
              flex: 1, padding: "10px 0", background: "none",
              border: "none", borderBottom: `2px solid ${tab === t ? "#00ffc8" : "transparent"}`,
              cursor: "pointer", fontFamily: "'Orbitron',monospace", fontSize: 10,
              letterSpacing: 2, textTransform: "uppercase",
              color: tab === t ? "#00ffc8" : "rgba(255,255,255,0.42)", transition: "all .2s",
            }}>{t === "login" ? "Sign In" : "Sign Up"}</button>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tab === "register" && (
            <>
              <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px", background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden",
                  border: "1.5px solid rgba(0,255,200,0.3)", flexShrink: 0, background: "rgba(0,255,200,0.08)",
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {avatarPreview ? <img src={avatarPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/> : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00ffc8" strokeWidth="1.6" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
                </div>
                <div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{avatarFile ? avatarFile.name : "Profile photo (optional)"}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>JPG · PNG · Max 5 MB</div>
                </div>
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleAvatar(e.target.files[0])}/>
              </label>
              <input style={inp} placeholder="Artist name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/>
            </>
          )}
          {/* Google Sign In */}
          <button onClick={handleGoogleLogin} disabled={googleLoading} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", padding: "12px 0", background: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "'Orbitron',monospace", fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "#1a1a2e", transition: "all .2s", opacity: googleLoading ? 0.7 : 1 }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            {googleLoading ? "LOADING..." : "CONTINUE WITH GOOGLE"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }}/>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.18)", letterSpacing: 2 }}>OR</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }}/>
          </div>
          <input style={inp} placeholder="Email *" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}/>
          <input style={inp} placeholder="Password *" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} onKeyDown={e => e.key === "Enter" && handleSubmit()}/>
          {error && <div style={{ fontSize: 12, color: "#ff4466", padding: "8px 12px", background: "rgba(255,68,102,0.08)", borderRadius: 6, border: "1px solid rgba(255,68,102,0.2)" }}>{error}</div>}
          <button onClick={handleSubmit} disabled={loading} style={{ ...solidBtn, marginTop: 6 }}>
            {loading ? "LOADING..." : tab === "login" ? "SIGN IN" : "CREATE ACCOUNT"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PLAYER ────────────────────────────────────────────────────────────────────
function Player({ player, setPlayer }) {
  const audioRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const { track } = player || {};

  useEffect(() => {
    if (!track?.audioUrl) return;
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = track.audioUrl;
    audioRef.current.play().catch(() => {});
    audioRef.current.ontimeupdate = () => {
      const a = audioRef.current;
      if (a.duration) setProgress((a.currentTime / a.duration) * 100);
    };
    audioRef.current.onended = () => setPlayer(p => ({ ...p, playing: false }));
    return () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current.ontimeupdate = null; } };
  }, [track?.id]);

  useEffect(() => {
    if (!audioRef.current) return;
    if (player?.playing) audioRef.current.play().catch(() => {});
    else audioRef.current.pause();
  }, [player?.playing]);

  if (!track) return null;

  const seek = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - r.left) / r.width;
    if (audioRef.current) audioRef.current.currentTime = audioRef.current.duration * pct;
  };

  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 68, zIndex: 300,
      background: "rgba(5,6,12,0.98)", borderTop: "1px solid rgba(0,255,200,0.2)",
      display: "flex", alignItems: "center", padding: "0 16px", gap: 12,
      backdropFilter: "blur(24px)" }}>
      <div style={{ width: 42, height: 42, borderRadius: 6, overflow: "hidden", flexShrink: 0,
        border: "1px solid rgba(0,255,200,0.12)" }}>
        {track.coverUrl ? <img src={track.coverUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
          : <GeoCover seed={track.id} size={42}/>}
      </div>
      <div style={{ minWidth: 0, flexShrink: 0, width: 130 }}>
        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#fff" }}>{track.title}</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.42)" }}>{track.artistName}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
        <button onClick={() => setPlayer(p => ({ ...p, playing: !p.playing }))}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#00ffc8",
            flexShrink: 0, padding: 0, filter: "drop-shadow(0 0 5px rgba(0,255,200,0.5))" }}>
          {player.playing ? <PauseIcon size={26}/> : <PlayIcon size={24}/>}
        </button>
        <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.08)", cursor: "pointer", borderRadius: 2 }} onClick={seek}>
          <div style={{ height: "100%", width: `${progress}%`, background: "#00ffc8", borderRadius: 2, transition: "width .1s linear" }}/>
        </div>
      </div>
      <button onClick={() => { setPlayer(null); if (audioRef.current) audioRef.current.pause(); }}
        style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.42)", padding: 0, fontSize: 16 }}>✕</button>
    </div>
  );
}

// ── FOOTER ────────────────────────────────────────────────────────────────────
function Footer() {
  const socials = [
    { name: "Instagram", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none"/></svg> },
    { name: "TikTok", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-6.13 6.33 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/></svg> },
    { name: "X / Twitter", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L2.18 2.25h6.952l4.256 5.628L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
    { name: "YouTube", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg> },
  ];
  return (
    <footer style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "48px 24px 32px",
      background: "rgba(4,5,10,0.99)", position: "relative", zIndex: 1, marginTop: 40 }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 40, marginBottom: 36 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <Logo size={26}/>
              <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 18, fontWeight: 900, color: "#00ffc8", letterSpacing: 4 }}>NEURØ</span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.42)", lineHeight: 1.85, maxWidth: 220 }}>
              The platform to share and discover AI-generated music. Built for creators, enjoyed by everyone.
            </p>
          </div>
          <div>
            <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 10, letterSpacing: 3, color: "rgba(255,255,255,0.18)", textTransform: "uppercase", marginBottom: 16 }}>Connect</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {socials.map(s => (
                <button key={s.name} onClick={() => alert(`${s.name} — Coming Soon!`)}
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.42)", padding: "6px 12px", borderRadius: 6, cursor: "pointer",
                    fontSize: 12, fontFamily: "'DM Sans',sans-serif", transition: "all .2s",
                    display: "flex", alignItems: "center", gap: 6 }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = "rgba(0,255,200,0.3)"; e.currentTarget.style.color = "#00ffc8"; }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.42)"; }}>
                  <span>{s.icon}</span> <span>{s.name}</span> <span style={{ fontSize: 9, opacity: 0.5 }}>SOON</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 10, letterSpacing: 3, color: "rgba(255,255,255,0.18)", textTransform: "uppercase", marginBottom: 16 }}>Legal</div>
            {["Terms of Service","Privacy Policy"].map(l => (
              <button key={l} onClick={() => alert("Coming soon")}
                style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.42)", background: "none", border: "none", cursor: "pointer", marginBottom: 10, fontFamily: "'DM Sans',sans-serif", padding: 0, textAlign: "left", transition: "color .2s" }}
                onMouseOver={e => e.target.style.color = "#00ffc8"}
                onMouseOut={e => e.target.style.color = "rgba(255,255,255,0.42)"}>
                {l}
              </button>
            ))}
            <a href={`mailto:${CONTACT_EMAIL}`}
              style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.42)", textDecoration: "none", transition: "color .2s" }}
              onMouseOver={e => e.target.style.color = "#00ffc8"}
              onMouseOut={e => e.target.style.color = "rgba(255,255,255,0.42)"}>
              Contact Us
            </a>
          </div>
        </div>
        <div style={{ paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.18)" }}>© {new Date().getFullYear()} NEURØ · All Rights Reserved</span>
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ fontSize: 12, color: "rgba(0,255,200,0.5)", textDecoration: "none" }}>{CONTACT_EMAIL}</a>
        </div>
      </div>
    </footer>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const { user, profile, loading, register, login, logout, refreshProfile } = useAuth();
  const [view, setView] = useState("feed");
  const [genre, setGenre] = useState("All");
  const [search, setSearch] = useState("");
  const [artistId, setArtistId] = useState(null);
  const [player, setPlayer] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editTrackData, setEditTrackData] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const { toast, show: showToast } = useToast();

  const { tracks, loading: tracksLoading } = useTracks(genre);
  const { artists } = useArtists();
  const artistTracks = useArtistTracks(view === "artist-page" ? artistId : null);
  const myTracks = useArtistTracks(view === "profile" ? user?.uid : null);
  const { liked, toggleLike } = useLikes(user?.uid);
  const { following, toggleFollow } = useFollows(user?.uid);

  const filtered = tracks.filter(t =>
    !search || t.title?.toLowerCase().includes(search.toLowerCase()) ||
    t.artistName?.toLowerCase().includes(search.toLowerCase())
  );

  const goArtist = (id) => { setArtistId(id); setView("artist-page"); window.scrollTo(0, 0); };
  const go = (v) => { setView(v); window.scrollTo(0, 0); };

  const handleDelete = async (track) => {
    try {
      await deleteTrack(track, user.uid);
      await refreshProfile();
      showToast("Track deleted");
      setConfirmDelete(null);
    } catch (e) { showToast("Error: " + e.message, "error"); }
  };

  const handleFollow = async (id) => {
    await toggleFollow(id);
    showToast(following.has(id) ? "Unfollowed" : "Now following!");
  };

  // Show loading max 8s — after that show auth screen regardless
  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#05060c", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
      <Logo size={52}/>
      <div style={{ fontFamily: "'Orbitron',monospace", color: "#00ffc8", letterSpacing: 4, fontSize: 13, opacity: 0.7 }}>LOADING...</div>
      <div style={{ width: 140, height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", background: "#00ffc8", borderRadius: 2, animation: "loadBar 1.4s ease-in-out infinite" }}/>
      </div>
      <style>{`@keyframes loadBar { 0%{width:0%;margin-left:0} 50%{width:60%;margin-left:20%} 100%{width:0%;margin-left:100%} }`}</style>
    </div>
  );

  if (!user) return <AuthScreen onAuth={() => {}} register={register} login={login}/>;

  const navActive = view === "artist-page" ? "artists" : view;

  return (
    <div style={{ minHeight: "100vh", background: "#05060c", color: "#dde1ed", fontFamily: "'DM Sans',sans-serif", overflowX: "hidden" }}>
      <style>{globalCSS}</style>
      <div style={{ position: "fixed", inset: 0, backgroundImage: "linear-gradient(rgba(0,255,200,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,200,0.018) 1px,transparent 1px)", backgroundSize: "52px 52px", pointerEvents: "none", zIndex: 0 }}/>

      {/* HEADER */}
      <header style={{ position: "sticky", top: 0, zIndex: 200, height: 66, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", background: "rgba(5,6,12,0.97)", borderBottom: "1px solid rgba(0,255,200,0.18)", backdropFilter: "blur(20px)", boxSizing: "border-box" }}>
        <div onClick={() => go("feed")} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flexShrink: 0 }}>
          <Logo size={42}/>
          <div>
            <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 17, fontWeight: 900, color: "#00ffc8", letterSpacing: 6, lineHeight: 1, textShadow: "0 0 14px rgba(0,255,200,0.5)" }}>NEURØ</div>
            <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 8, letterSpacing: 4, color: "rgba(255,255,255,0.18)", marginTop: 3 }}>AI MUSIC</div>
          </div>
        </div>
        <div style={{ flex: 1, maxWidth: 300, margin: "0 12px", display: window.innerWidth < 560 ? "none" : "block" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "9px 14px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tracks, artists..."
              style={{ background: "none", border: "none", outline: "none", color: "#dde1ed", fontFamily: "'DM Sans',sans-serif", fontSize: 13, width: "100%" }}/>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setUploadOpen(true)} style={{ ...solidBtn, padding: "8px 16px", fontSize: 10, whiteSpace: "nowrap" }}>+ UPLOAD</button>
          <div onClick={() => go("profile")} style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", cursor: "pointer", background: "#0e1020", border: "1.5px solid rgba(0,255,200,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/> : <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 12, fontWeight: 700, color: "#00ffc8" }}>{profile?.name?.[0]?.toUpperCase() || "?"}</span>}
          </div>
        </div>
      </header>

      {/* NAV */}
      <nav style={{ display: "flex", justifyContent: "center", background: "rgba(5,6,12,0.92)", borderBottom: "1px solid rgba(255,255,255,0.07)", position: "sticky", top: 66, zIndex: 190, backdropFilter: "blur(14px)" }}>
        {[["feed","Feed"],["explore","Explore"],["artists","Artists"],["profile","My Profile"]].map(([v,l]) => (
          <button key={v} onClick={() => go(v)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "10px clamp(12px,3vw,32px)", background: "none", border: "none", borderBottom: `2px solid ${navActive === v ? "#00ffc8" : "transparent"}`, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 11, letterSpacing: "1.5px", fontWeight: 600, textTransform: "uppercase", color: navActive === v ? "#00ffc8" : "rgba(255,255,255,0.42)", transition: "all .2s" }}>
            <span style={{ fontSize: 13 }}>{v === "feed" ? "◈" : v === "explore" ? "◎" : v === "artists" ? "◉" : "◍"}</span>
            <span>{l}</span>
          </button>
        ))}
      </nav>

      {/* PAGES */}
      <main style={{ maxWidth: 1080, margin: "0 auto", width: "100%", padding: "0 14px 140px", boxSizing: "border-box", position: "relative", zIndex: 1 }}>
        {view === "feed" && <FeedView tracks={filtered} artists={artists} genre={genre} setGenre={setGenre} liked={liked} following={following} player={player} setPlayer={setPlayer} onLike={toggleLike} onFollow={handleFollow} onArtistClick={goArtist} onUpload={() => setUploadOpen(true)} userId={user.uid}/>}
        {view === "explore" && <ExploreView tracks={tracks} player={player} setPlayer={setPlayer} liked={liked} onLike={toggleLike} onArtistClick={goArtist}/>}
        {view === "artists" && <ArtistsView artists={artists} following={following} onFollow={handleFollow} onArtistClick={goArtist}/>}
        {view === "profile" && <ProfileView profile={profile} tracks={myTracks} player={player} setPlayer={setPlayer} liked={liked} onLike={toggleLike} following={following} onEdit={setEditTrackData} onDelete={setConfirmDelete} onLogout={() => { logout(); }} refreshProfile={refreshProfile}/>}
        {view === "artist-page" && <ArtistPageView artistId={artistId} tracks={artistTracks} artists={artists} following={following} onFollow={handleFollow} player={player} setPlayer={setPlayer} liked={liked} onLike={toggleLike} onBack={() => go("artists")} onArtistClick={goArtist} userId={user.uid}/>}
      </main>

      <Footer/>
      {player && <Player player={player} setPlayer={setPlayer}/>}
      {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} onSuccess={() => { setUploadOpen(false); showToast("Track published!"); refreshProfile(); }} user={user} profile={profile}/>}
      {editTrackData && <EditModal track={editTrackData} onClose={() => setEditTrackData(null)} onSuccess={(msg) => { setEditTrackData(null); showToast(msg); }} userId={user.uid}/>}
      {confirmDelete && (
        <Overlay onClose={() => setConfirmDelete(null)}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 16, color: "#ff4466", marginBottom: 12 }}>DELETE TRACK?</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.42)", marginBottom: 24 }}>"{confirmDelete.title}" will be permanently deleted.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ ...ghostBtn, flex: 1 }}>Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} style={{ flex: 2, background: "rgba(255,68,102,0.15)", border: "1px solid rgba(255,68,102,0.4)", color: "#ff4466", padding: "12px 0", borderRadius: 8, cursor: "pointer", fontFamily: "'Orbitron',monospace", fontSize: 11, letterSpacing: 2, fontWeight: 700 }}>DELETE</button>
            </div>
          </div>
        </Overlay>
      )}
      <Toast toast={toast}/>
    </div>
  );
}

// ── PAGE COMPONENTS ───────────────────────────────────────────────────────────
function FeedView({ tracks, artists, genre, setGenre, liked, following, player, setPlayer, onLike, onFollow, onArtistClick, onUpload, userId }) {
  const topArtists = [...artists].sort((a, b) => (b.followers || 0) - (a.followers || 0)).slice(0, 6);
  return (
    <div style={{ paddingTop: 24 }}>
      {/* Hero */}
      <div style={{ margin: "0 0 28px", padding: "44px 32px", position: "relative", overflow: "hidden", border: "1px solid rgba(0,255,200,0.18)", borderRadius: 14, background: "linear-gradient(135deg,rgba(0,255,200,0.035),rgba(0,128,255,0.028))" }}>
        <div style={{ position: "absolute", top: -60, right: -60, width: 280, height: 280, background: "radial-gradient(circle,rgba(0,255,200,0.08),transparent 70%)", pointerEvents: "none" }}/>
        <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 9, letterSpacing: 4, color: "rgba(0,255,200,0.5)", marginBottom: 12 }}>// THE NEW ERA OF AI-GENERATED MUSIC</div>
        <h1 style={{ fontFamily: "'Orbitron',monospace", fontSize: "clamp(22px,4vw,34px)", fontWeight: 900, lineHeight: 1.15, marginBottom: 14 }}>
          MUSIC CREATED<br/><em style={{ color: "#00ffc8", textShadow: "0 0 28px rgba(0,255,200,0.45)", fontStyle: "normal" }}>WITH AI</em>
        </h1>
        <p style={{ color: "rgba(255,255,255,0.42)", fontSize: 14, lineHeight: 1.8, maxWidth: 480, marginBottom: 24 }}>Upload and share your tracks generated with Suno, Udio, Stable Audio and more.</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button onClick={onUpload} style={solidBtn}>UPLOAD TRACK</button>
          <button onClick={() => {}} style={ghostBtn}>EXPLORE</button>
        </div>
      </div>
      {/* Top artists */}
      <SectionHeader title="TOP ARTISTS" action={{ label: "See all →", onClick: () => {} }}/>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 12, marginBottom: 32 }}>
        {topArtists.map(a => (
          <div key={a.id} onClick={() => onArtistClick(a.id)} style={{ background: "rgba(255,255,255,0.022)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "20px 14px", textAlign: "center", cursor: "pointer", transition: "all .25s" }}
            onMouseOver={e => { e.currentTarget.style.borderColor = "rgba(0,255,200,0.22)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.transform = "none"; }}>
            <div style={{ width: 58, height: 58, borderRadius: "50%", margin: "0 auto 10px", overflow: "hidden", border: "1.5px solid rgba(0,255,200,0.18)" }}>
              <Avatar src={a.avatarUrl} seed={a.id} size={58}/>
            </div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 17, letterSpacing: 1, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 3 }}>{a.name}</div>
            <div style={{ fontSize: 11, color: "rgba(0,255,200,0.6)", marginBottom: 12 }}>{fmt(a.followers || 0)} followers</div>
            <button onClick={e => { e.stopPropagation(); onFollow(a.id); }} style={following.has(a.id) ? followingBtn : followBtn}>
              {following.has(a.id) ? "✓ FOLLOWING" : "+ FOLLOW"}
            </button>
          </div>
        ))}
      </div>
      {/* Genre pills + tracks */}
      <SectionHeader title="TRACKS"/>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 20 }}>
        {["All", ...GENRES].map(g => (
          <button key={g} onClick={() => setGenre(g)} style={{ padding: "6px 16px", border: `1px solid ${genre === g ? "#00ffc8" : "rgba(255,255,255,0.07)"}`, background: genre === g ? "rgba(0,255,200,0.07)" : "transparent", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", borderRadius: 20, color: genre === g ? "#00ffc8" : "rgba(255,255,255,0.42)", transition: "all .2s", flexShrink: 0 }}>{g}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 0 }}>
        {tracks.length ? tracks.map(t => (
          <TrackCard key={t.id} track={t} isOwn={false} player={player} setPlayer={setPlayer} liked={liked} onLike={toggleLike => toggleLike(t)} onArtistClick={onArtistClick}
            onLike={onLike} onEdit={() => {}} onDelete={() => {}}/>
        )) : <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(255,255,255,0.18)", fontSize: 13 }}>No tracks found</div>}
      </div>
    </div>
  );
}

function ExploreView({ tracks, player, setPlayer, liked, onLike, onArtistClick }) {
  const activeGenres = GENRES.filter(g => tracks.some(t => t.genre === g));
  const top5 = [...tracks].sort((a, b) => (b.plays || 0) - (a.plays || 0)).slice(0, 5);
  return (
    <div style={{ paddingTop: 24 }}>
      <h2 style={{ fontFamily: "'Orbitron',monospace", fontSize: 20, letterSpacing: 3, color: "#00ffc8", marginBottom: 6 }}>EXPLORE</h2>
      <p style={{ color: "rgba(255,255,255,0.42)", fontSize: 14, marginBottom: 32 }}>Browse by genre · {tracks.length} tracks available</p>
      <SectionHeader title="MOST PLAYED"/>
      <div style={{ marginBottom: 36 }}>
        {top5.map((t, i) => (
          <div key={t.id} onClick={() => setPlayer({ id: t.id, playing: true, track: t })} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 8, background: "rgba(255,255,255,0.022)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 8, cursor: "pointer", transition: "all .2s" }}
            onMouseOver={e => e.currentTarget.style.borderColor = "rgba(0,255,200,0.18)"}
            onMouseOut={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"}>
            <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 15, fontWeight: 900, width: 26, color: i < 3 ? "#00ffc8" : "rgba(255,255,255,0.18)" }}>{String(i+1).padStart(2,"0")}</span>
            <div style={{ width: 40, height: 40, borderRadius: 6, overflow: "hidden", border: "1px solid rgba(0,255,200,0.1)", flexShrink: 0 }}>
              {t.coverUrl ? <img src={t.coverUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/> : <GeoCover seed={t.id} size={40}/>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.42)", cursor: "pointer" }} onClick={e => { e.stopPropagation(); onArtistClick(t.artistId); }}>{t.artistName}</div>
            </div>
            <span style={tagStyle("neon")}>{t.genre}</span>
            <div style={{ fontSize: 11, color: "rgba(0,255,200,0.55)", textAlign: "right", flexShrink: 0 }}>{fmt(t.plays || 0)}</div>
          </div>
        ))}
      </div>
      <SectionHeader title="BY GENRE"/>
      {activeGenres.map(g => {
        const gt = tracks.filter(t => t.genre === g);
        return (
          <div key={g} style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "rgba(9,11,20,1)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px 8px 0 0", marginBottom: 1 }}>
              <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 12, letterSpacing: 2, color: "#00ffc8" }}>{g.toUpperCase()}</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.18)" }}>{gt.length} track{gt.length !== 1 ? "s" : ""}</span>
            </div>
            <div style={{ border: "1px solid rgba(255,255,255,0.07)", borderTop: "none", borderRadius: "0 0 8px 8px", padding: 12, background: "rgba(255,255,255,0.01)", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 8 }}>
              {gt.map(t => (
                <div key={t.id} onClick={() => setPlayer({ id: t.id, playing: true, track: t })} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 6, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", cursor: "pointer", transition: "all .2s" }}
                  onMouseOver={e => e.currentTarget.style.borderColor = "rgba(0,255,200,0.15)"}
                  onMouseOut={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"}>
                  <div style={{ width: 38, height: 38, borderRadius: 5, overflow: "hidden", flexShrink: 0 }}>
                    {t.coverUrl ? <img src={t.coverUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/> : <GeoCover seed={t.id} size={38}/>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.42)" }}>{t.artistName}</div>
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(0,255,200,0.5)", flexShrink: 0 }}>{fmt(t.plays || 0)}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ArtistsView({ artists, following, onFollow, onArtistClick }) {
  return (
    <div style={{ paddingTop: 24 }}>
      <h2 style={{ fontFamily: "'Orbitron',monospace", fontSize: 20, letterSpacing: 3, color: "#00ffc8", marginBottom: 6 }}>ARTISTS</h2>
      <p style={{ color: "rgba(255,255,255,0.42)", fontSize: 14, marginBottom: 28 }}>AI music creators on NEURØ</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 14 }}>
        {artists.map(a => (
          <div key={a.id} onClick={() => onArtistClick(a.id)} style={{ background: "rgba(255,255,255,0.022)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 24, textAlign: "center", cursor: "pointer", transition: "all .25s" }}
            onMouseOver={e => { e.currentTarget.style.borderColor = "rgba(0,255,200,0.22)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.transform = "none"; }}>
            <div style={{ width: 68, height: 68, borderRadius: "50%", margin: "0 auto 12px", overflow: "hidden", border: "1.5px solid rgba(0,255,200,0.18)" }}>
              <Avatar src={a.avatarUrl} seed={a.id} size={68}/>
            </div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 1.5, color: "#fff", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 22, marginBottom: 16 }}>
              <div><div style={{ fontSize: 17, fontWeight: 700, color: "#00ffc8" }}>{a.tracksCount || 0}</div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", letterSpacing: 1 }}>TRACKS</div></div>
              <div><div style={{ fontSize: 17, fontWeight: 700, color: "#00ffc8" }}>{fmt(a.followers || 0)}</div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", letterSpacing: 1 }}>FOLLOWERS</div></div>
            </div>
            <button onClick={e => { e.stopPropagation(); onFollow(a.id); }} style={following.has(a.id) ? followingBtn : followBtn}>
              {following.has(a.id) ? "✓ FOLLOWING" : "+ FOLLOW"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArtistPageView({ artistId, tracks, artists, following, onFollow, player, setPlayer, liked, onLike, onBack, onArtistClick, userId }) {
  const artist = artists.find(a => a.id === artistId);
  if (!artist) return null;
  const totalPlays = tracks.reduce((s, t) => s + (t.plays || 0), 0);
  return (
    <div>
      <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "none", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.42)", padding: "8px 18px", borderRadius: 7, cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans',sans-serif", transition: "all .2s", margin: "20px 0 4px" }}
        onMouseOver={e => { e.currentTarget.style.borderColor = "rgba(0,255,200,0.35)"; e.currentTarget.style.color = "#00ffc8"; }}
        onMouseOut={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "rgba(255,255,255,0.42)"; }}>
        ← Back
      </button>
      <div style={{ padding: 32, margin: "8px 0 28px", borderRadius: 14, position: "relative", overflow: "hidden", background: "linear-gradient(135deg,rgba(0,255,200,0.035),rgba(0,128,255,0.028))", border: "1px solid rgba(0,255,200,0.18)" }}>
        <div style={{ display: "flex", gap: 22, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(0,255,200,0.3)", flexShrink: 0 }}>
            <Avatar src={artist.avatarUrl} seed={artist.id} size={80}/>
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(26px,4vw,38px)", color: "#00ffc8", marginBottom: 4, letterSpacing: 3 }}>{artist.name}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.42)", marginBottom: 18 }}>AI Music Creator · NEURØ Platform</div>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
              {[["TRACKS", tracks.length],["FOLLOWERS", fmt(artist.followers||0)],["PLAYS", fmt(totalPlays)]].map(([l,v]) => (
                <div key={l}><div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>{v}</div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", letterSpacing: 1, textTransform: "uppercase", marginTop: 2 }}>{l}</div></div>
              ))}
            </div>
          </div>
          {userId !== artistId && (
            <button onClick={() => onFollow(artistId)} style={{ ...(following.has(artistId) ? followingBtn : followBtn), minWidth: 160, alignSelf: "flex-start" }}>
              {following.has(artistId) ? "✓ FOLLOWING" : "+ FOLLOW"}
            </button>
          )}
        </div>
      </div>
      <SectionHeader title={`TRACKS BY ${artist.name?.toUpperCase()}`}/>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 10 }}>
        {tracks.length ? tracks.map(t => <TrackCard key={t.id} track={t} isOwn={false} player={player} setPlayer={setPlayer} liked={liked} onLike={onLike} onEdit={() => {}} onDelete={() => {}} onArtistClick={onArtistClick}/>) : <div style={{ padding: "40px", textAlign: "center", color: "rgba(255,255,255,0.18)", fontSize: 13 }}>No published tracks yet</div>}
      </div>
    </div>
  );
}

function ProfileView({ profile, tracks, player, setPlayer, liked, onLike, following, onEdit, onDelete, onLogout, refreshProfile }) {
  return (
    <div style={{ paddingTop: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: 24, borderRadius: 12, border: "1px solid rgba(0,255,200,0.18)", overflow: "hidden", background: "rgba(0,255,200,0.016)", marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, width: "100%" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(0,255,200,0.25)", flexShrink: 0 }}>
            <Avatar src={profile?.avatarUrl} seed={profile?.uid} size={72}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: "#00ffc8", marginBottom: 3, letterSpacing: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile?.name || "Artist"}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.42)" }}>AI Music Creator · NEURØ</div>
          </div>
          <button onClick={onLogout} style={{ ...ghostBtn, flexShrink: 0, padding: "8px 14px", fontSize: 10, whiteSpace: "nowrap" }}>Sign Out</button>
        </div>
        <div style={{ display: "flex", gap: 0, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 18, width: "100%" }}>
          {[["Tracks", profile?.tracksCount || 0],["Followers", fmt(profile?.followers || 0)],["Following", fmt(profile?.following || 0)]].map(([l,v], i) => (
            <div key={l} style={{ flex: 1, textAlign: "center", borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>{v}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", letterSpacing: "1.5px", marginTop: 2, textTransform: "uppercase" }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      <SectionHeader title="MY TRACKS"/>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 10 }}>
        {tracks.length ? tracks.map(t => <TrackCard key={t.id} track={t} isOwn={true} player={player} setPlayer={setPlayer} liked={liked} onLike={onLike} onEdit={onEdit} onDelete={onDelete} onArtistClick={() => {}}/>) : (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "48px 0" }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.18)", marginBottom: 16 }}>You haven't published any tracks yet</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── SMALL UI PIECES ───────────────────────────────────────────────────────────
function Overlay({ children, onClose }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget && onClose) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(14px)", zIndex: 500, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0 }}>
      <div style={{ background: "#080b16", border: "1px solid rgba(0,255,200,0.18)", width: "100%", maxWidth: 520, padding: "32px 24px 40px", position: "relative", borderRadius: "20px 20px 0 0", boxShadow: "0 0 60px rgba(0,255,200,0.06)", maxHeight: "92vh", overflowY: "auto" }}>
        {children}
      </div>
    </div>
  );
}
function Field({ label, children }) {
  return <div><label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.18)", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 7 }}>{label}</label>{children}</div>;
}
function SectionHeader({ title, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 11, letterSpacing: 3, color: "rgba(255,255,255,0.42)", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 3, height: 13, background: "#00ffc8", borderRadius: 2, flexShrink: 0 }}/>
        {title}
      </div>
      {action && <button onClick={action.onClick} style={{ fontSize: 12, color: "#00ffc8", background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", opacity: 0.7 }}>{action.label}</button>}
    </div>
  );
}

// ── ICONS ─────────────────────────────────────────────────────────────────────
const PlayIcon = ({ size = 20 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>;
const PauseIcon = ({ size = 20 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>;
const EditIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const TrashIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/><path d="M10,11v6"/><path d="M14,11v6"/><path d="M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1V6"/></svg>;

// ── HELPERS ───────────────────────────────────────────────────────────────────
const fmt = (n) => n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n || 0);
const tagStyle = (t) => ({
  fontSize: 10, padding: "2px 8px", borderRadius: 4,
  background: t === "neon" ? "rgba(0,255,200,0.08)" : "rgba(255,255,255,0.04)",
  border: `1px solid ${t === "neon" ? "rgba(0,255,200,0.14)" : "rgba(255,255,255,0.07)"}`,
  color: t === "neon" ? "rgba(0,255,200,0.75)" : "rgba(255,255,255,0.18)",
});
const ownerBtn = (color) => ({
  background: `rgba(${color === "#00ffc8" ? "0,255,200" : "255,68,102"},0.07)`,
  border: `1px solid rgba(${color === "#00ffc8" ? "0,255,200" : "255,68,102"},0.2)`,
  color: `rgba(${color === "#00ffc8" ? "0,255,200" : "255,68,102"},0.6)`,
  width: 30, height: 30, borderRadius: 7, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  transition: "all .2s", padding: 0,
});

// Button styles
const solidBtn = { background: "#00ffc8", border: "none", color: "#000", padding: "11px 24px", cursor: "pointer", fontFamily: "'Orbitron',monospace", fontSize: 10, letterSpacing: 2, fontWeight: 700, borderRadius: 8, transition: "all .2s", width: "100%" };
const ghostBtn = { background: "transparent", border: "1px solid #00ffc8", color: "#00ffc8", padding: "11px 24px", cursor: "pointer", fontFamily: "'Orbitron',monospace", fontSize: 10, letterSpacing: 2, borderRadius: 8, transition: "all .2s", width: "100%" };
const followBtn = { width: "100%", padding: "11px 0", borderRadius: 8, fontFamily: "'Orbitron',monospace", fontSize: 11, letterSpacing: 2, fontWeight: 700, cursor: "pointer", background: "#00ffc8", border: "none", color: "#000", transition: "all .25s" };
const followingBtn = { width: "100%", padding: "11px 0", borderRadius: 8, fontFamily: "'Orbitron',monospace", fontSize: 11, letterSpacing: 2, fontWeight: 700, cursor: "pointer", background: "transparent", border: "1px solid rgba(0,255,200,0.35)", color: "#00ffc8", transition: "all .25s" };
const inp = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#dde1ed", padding: "14px", fontFamily: "'DM Sans',sans-serif", fontSize: 16, outline: "none", width: "100%", borderRadius: 8, boxSizing: "border-box" };

// Global CSS
const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=DM+Sans:wght@300;400;500;600;700&family=Bebas+Neue&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  ::-webkit-scrollbar{width:4px}
  ::-webkit-scrollbar-thumb{background:rgba(0,255,200,0.18);border-radius:4px}
  input:focus,select:focus{border-color:#00ffc8 !important;box-shadow:0 0 8px rgba(0,255,200,0.1)}
  select option{background:#0a0c18}
  @keyframes fadeUp{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}
`;
