'use client';

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Role, User } from './types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PATCH';

interface DriverSignupInput {
  name: string;
  phoneNumber: string;
  password: string;
  licenseNumber: string;
  vehicle: { modelName: string; plateNumber: string; capacity: number };
}

interface Session {
  apiUrl: string;
  /** False until the stored token has been checked against /me. */
  ready: boolean;
  user: User | null;
  request: <T>(method: Method, path: string, body?: unknown) => Promise<T>;
  signIn: (role: Role, phoneNumber: string, password: string) => Promise<User>;
  signUp: (name: string, phoneNumber: string, password: string) => Promise<User>;
  signUpDriver: (input: DriverSignupInput) => Promise<User>;
  signOut: () => void;
  refreshUser: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);
const TOKEN_KEY = 'oi-tesla.token';

// Storage can throw (private mode, blocked cookies) — the app still works, it
// just forgets the session on reload.
const storage = {
  get: () => {
    try {
      return window.localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (v: string | null) => {
    try {
      if (v) window.localStorage.setItem(TOKEN_KEY, v);
      else window.localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

export function SessionProvider({ apiUrl, children }: { apiUrl: string; children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const tokenRef = useRef<string | null>(null);

  const signOut = useCallback(() => {
    tokenRef.current = null;
    storage.set(null);
    setUser(null);
  }, []);

  const request = useCallback(
    async <T,>(method: Method, path: string, body?: unknown): Promise<T> => {
      let res: Response;
      try {
        res = await fetch(`${apiUrl}${path}`, {
          method,
          headers: {
            ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
            ...(tokenRef.current ? { authorization: `Bearer ${tokenRef.current}` } : {}),
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
          cache: 'no-store',
        });
      } catch {
        throw new ApiError(0, 'NETWORK', 'Cannot reach the Oi Tesla API. Is it running?');
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 401 && tokenRef.current) signOut();
        throw new ApiError(
          res.status,
          data?.error?.code ?? `HTTP_${res.status}`,
          data?.error?.message ?? `Request failed (${res.status})`,
          data?.error?.details,
        );
      }
      return data as T;
    },
    [apiUrl, signOut],
  );

  const refreshUser = useCallback(async () => {
    setUser(await request<User>('GET', '/api/auth/me'));
  }, [request]);

  useEffect(() => {
    tokenRef.current = storage.get();
    if (!tokenRef.current) {
      setReady(true);
      return;
    }
    refreshUser()
      .catch(() => signOut())
      .finally(() => setReady(true));
  }, [refreshUser, signOut]);

  const adopt = useCallback((token: string, u: User) => {
    tokenRef.current = token;
    storage.set(token);
    setUser(u);
    return u;
  }, []);

  const signIn = useCallback(
    async (role: Role, phoneNumber: string, password: string) => {
      const path = role === 'driver' ? '/api/auth/drivers/login' : '/api/auth/passengers/login';
      const { token, user: u } = await request<{ token: string; user: User }>('POST', path, { phoneNumber, password });
      return adopt(token, u);
    },
    [request, adopt],
  );

  const signUp = useCallback(
    async (name: string, phoneNumber: string, password: string) => {
      const { token, user: u } = await request<{ token: string; user: User }>('POST', '/api/auth/passengers/signup', {
        name,
        phoneNumber,
        password,
      });
      return adopt(token, u);
    },
    [request, adopt],
  );

  const signUpDriver = useCallback(
    async (input: DriverSignupInput) => {
      const { token, user: u } = await request<{ token: string; user: User }>('POST', '/api/auth/drivers/signup', input);
      return adopt(token, u);
    },
    [request, adopt],
  );

  const value = useMemo(
    () => ({ apiUrl, ready, user, request, signIn, signUp, signUpDriver, signOut, refreshUser }),
    [apiUrl, ready, user, request, signIn, signUp, signUpDriver, signOut, refreshUser],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}

export const homeFor = (role: Role) => (role === 'driver' ? '/driver' : '/passenger');
