'use client';

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { getFirebaseAuth } from './SimpleAuthProvider';
import { apiFetch } from '@/lib/api';

export const UserContext = createContext<{
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  role: string;
}>({ user: null, loading: true, isAdmin: false, role: 'member' });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState('member');

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setup = async () => {
      try {
        const firebaseAuth = await getFirebaseAuth();
        unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
          if (currentUser) {
            setUser(currentUser);
            try {
              const res = await apiFetch<{
                success: boolean;
                isNew?: boolean;
                data?: { isAdmin?: boolean; role?: string };
              }>('/api/users', {
                method: 'POST',
                body: JSON.stringify({
                  uid: currentUser.uid,
                  email: currentUser.email,
                  display_name: currentUser.displayName,
                }),
              });
              setIsAdmin(Boolean(res.data?.isAdmin));
              setRole(res.data?.role || 'member');
            } catch (err) {
              console.warn('[AuthProvider] backend sync failed:', err);
              setIsAdmin(false);
              setRole('member');
            }
          } else {
            setUser(null);
            setIsAdmin(false);
            setRole('member');
          }
          setLoading(false);
        });
      } catch {
        setLoading(false);
      }
    };

    setup();
    return () => unsubscribe?.();
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, isAdmin, role }}>
      {children}
    </UserContext.Provider>
  );
};

export const useAuth = () => React.useContext(UserContext);
