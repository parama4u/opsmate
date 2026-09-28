import { NextResponse } from 'next/server';

export async function GET() {
  const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID,
    ssoProviderId: process.env.FIREBASE_SSO_PROVIDER_ID || null,
    ssoProviderType: process.env.FIREBASE_SSO_PROVIDER_TYPE || null,
  };

  const required = ['apiKey', 'authDomain', 'projectId', 'appId'] as const;
  const missing = required.filter((k) => !firebaseConfig[k]);

  if (missing.length) {
    return NextResponse.json({ error: 'Firebase configuration incomplete' }, { status: 500 });
  }

  return NextResponse.json(firebaseConfig);
}
