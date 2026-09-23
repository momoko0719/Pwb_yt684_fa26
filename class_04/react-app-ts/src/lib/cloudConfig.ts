/**
 * Save / load studio configuration via Firestore only.
 * (No Storage — this app only saves small JSON settings.)
 */
import {
  doc, setDoc, getDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { StudioConfig } from './studioConfig';
import { mergeStudioConfig } from './studioConfig';

const CONFIG_ID = 'default';

export async function saveStudioConfig(uid: string, config: StudioConfig, name = 'My clay preset') {
  if (!db) throw new Error('Firebase not configured');

  await setDoc(doc(db, 'users', uid, 'configs', CONFIG_ID), {
    version: 1 as const,
    name,
    updatedAt: serverTimestamp(),
    config,
  });

  return { firestorePath: `users/${uid}/configs/${CONFIG_ID}` };
}

export async function loadStudioConfig(uid: string): Promise<StudioConfig | null> {
  if (!db) throw new Error('Firebase not configured');

  const snap = await getDoc(doc(db, 'users', uid, 'configs', CONFIG_ID));
  if (!snap.exists()) return null;
  return mergeStudioConfig(snap.data().config);
}
