/**
 * Cloud bar — Google Auth + save/load studio configuration.
 */
import { useEffect, useState } from 'react';
import {
  onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut,
  type User,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../lib/firebase';
import { saveStudioConfig, loadStudioConfig } from '../lib/cloudConfig';
import { useStudioConfig } from '../studio/StudioConfigContext';

export default function CloudBar() {
  const { config, applyLoaded } = useStudioConfig();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, setUser);
  }, []);

  if (!isFirebaseConfigured) {
    return (
      <div className="cloud-bar cloud-bar-warn">
        <span>Cloud off — add <code>.env.local</code> (see Firebase tutorial)</span>
      </div>
    );
  }

  const onSignIn = async () => {
    if (!auth) return;
    setBusy(true);
    setStatus('');
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      setStatus('Signed in');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  const onSignOut = async () => {
    if (!auth) return;
    await signOut(auth);
    setStatus('Signed out');
  };

  const onSave = async () => {
    if (!user) { setStatus('Sign in first'); return; }
    setBusy(true);
    setStatus('Saving…');
    try {
      await saveStudioConfig(user.uid, config);
      setStatus('Saved to Firestore');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const onLoad = async () => {
    if (!user) { setStatus('Sign in first'); return; }
    setBusy(true);
    setStatus('Loading…');
    try {
      const loaded = await loadStudioConfig(user.uid);
      if (!loaded) {
        setStatus('No saved config yet — save once first');
      } else {
        applyLoaded(loaded);
        setStatus('Loaded');
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cloud-bar">
      <span className="cloud-label">Cloud</span>
      {user ? (
        <>
          <span className="cloud-user" title={user.email ?? user.uid}>
            {user.displayName ?? user.email ?? 'User'}
          </span>
          <button type="button" className="cloud-btn" disabled={busy} onClick={onSave}>Save</button>
          <button type="button" className="cloud-btn" disabled={busy} onClick={onLoad}>Load</button>
          <button type="button" className="cloud-btn ghost" disabled={busy} onClick={onSignOut}>Out</button>
        </>
      ) : (
        <button type="button" className="cloud-btn primary" disabled={busy} onClick={onSignIn}>
          Sign in with Google
        </button>
      )}
      {status && <span className="cloud-status">{status}</span>}
    </div>
  );
}
