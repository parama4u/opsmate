import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';

function initAdmin() {
  if (admin.apps.length) return;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    initAdmin();
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const idToken = payload && typeof payload === 'object' && 'idToken' in payload
      ? payload.idToken
      : null;
    if (typeof idToken !== 'string' || !idToken.trim()) {
      return NextResponse.json({ error: 'idToken required' }, { status: 400 });
    }
    if (!admin.apps.length) {
      return NextResponse.json({ error: 'Firebase admin not configured' }, { status: 503 });
    }
    const decoded = await admin.auth().verifyIdToken(idToken);
    return NextResponse.json({
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
    });
  } catch {
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 401 }
    );
  }
}
