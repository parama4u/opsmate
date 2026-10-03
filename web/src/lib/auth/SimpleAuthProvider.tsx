'use client';

import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  inMemoryPersistence,
  indexedDBLocalPersistence,
  GoogleAuthProvider,
  initializeAuth,
  OAuthProvider,
  SAMLAuthProvider,
  signInWithPopup,
} from 'firebase/auth';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let initialization: Promise<{ app: FirebaseApp; auth: Auth }> | null = null;
let identityProvider: { id: string | null; type: 'oidc' | 'saml' | null } = { id: null, type: null };

const initializeFirebase = async () => {
  if (app && auth) return { app, auth };

  if (!initialization) {
    initialization = (async () => {
      const response = await fetch('/api/firebase-config');
      if (!response.ok) throw new Error('Failed to fetch Firebase config');

      const firebaseConfig = await response.json() as {
        apiKey: string;
        authDomain: string;
        projectId: string;
        storageBucket?: string;
        messagingSenderId?: string;
        appId: string;
        measurementId?: string;
        ssoProviderId?: string | null;
        ssoProviderType?: string | null;
      };
      identityProvider = {
        id: firebaseConfig.ssoProviderId || null,
        type: firebaseConfig.ssoProviderType === 'saml' ? 'saml' : firebaseConfig.ssoProviderId ? 'oidc' : null,
      };
      app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      try {
        auth = initializeAuth(app, {
          persistence: [browserLocalPersistence, indexedDBLocalPersistence, inMemoryPersistence],
          popupRedirectResolver: browserPopupRedirectResolver,
        });
      } catch (error: unknown) {
        const code = typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code)
          : '';
        if (code !== 'auth/already-initialized') throw error;
        auth = getAuth(app);
      }
      return { app, auth };
    })().catch((error: unknown) => {
      initialization = null;
      throw error;
    });
  }

  return initialization;
};

export const getFirebaseApp = async () => {
  const { app: firebaseApp } = await initializeFirebase();
  return firebaseApp;
};

export const getFirebaseAuth = async () => {
  const { auth: firebaseAuth } = await initializeFirebase();
  return firebaseAuth;
};

export const signInWithConfiguredPopup = async () => {
  const firebaseAuth = await getFirebaseAuth();
  const provider = identityProvider.id
    ? identityProvider.type === 'saml'
      ? new SAMLAuthProvider(identityProvider.id)
      : new OAuthProvider(identityProvider.id)
    : new GoogleAuthProvider();
  if (!identityProvider.id) provider.setCustomParameters({ prompt: 'select_account' });
  const popupResult = signInWithPopup(firebaseAuth, provider);
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(Object.assign(new Error('Google sign-in popup timed out'), { code: 'auth/popup-timeout' }));
    }, 45000);
  });
  try {
    const credential = await Promise.race([popupResult, timeout]);
    await credential.user.getIdToken(true);
    return credential.user;
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
};

export const signInWithGooglePopup = signInWithConfiguredPopup;

export const getAuthErrorMessage = (error: unknown) => {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : '';

  switch (code) {
    case 'auth/popup-blocked':
      return 'Sign-in popup was blocked. Allow popups for this site and try again.';
    case 'auth/popup-closed-by-user':
      return 'The sign-in popup closed before account selection. Allow popups for this site and try again.';
    case 'auth/cancelled-popup-request':
      return 'Another Google sign-in popup is already open. Close it and try again.';
    case 'auth/network-request-failed':
      return 'Google sign-in could not reach Firebase. Check the connection and try again.';
    case 'auth/internal-error':
      return 'Sign-in encountered a browser error. Allow popups for this site and try again.';
    case 'auth/popup-timeout':
      return 'The sign-in popup did not complete. Allow popups for this site and try again.';
    case 'auth/web-storage-unsupported':
    case 'auth/operation-not-supported-in-this-environment':
      return 'This browser cannot complete popup sign-in. Open the app in Chrome or another full browser and try again.';
    case 'auth/unauthorized-domain':
      return 'This site is not authorized in Firebase Authentication. Add the current site domain to Firebase Authentication authorized domains, then try again.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled in Firebase Authentication.';
    default:
      return 'Sign-in could not be completed. Check your Firebase configuration and try again.';
  }
};
