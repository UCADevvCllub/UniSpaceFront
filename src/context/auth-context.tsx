"use client";

import {
  GoogleAuthProvider,
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
  classYear: string;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const signIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Sign-in error:", error);
      alert("Sign-in failed: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const logOut = async () => {
    await signOut(auth);
  };

  const classYear = useMemo(() => {
    const fallback = "Class of 2027";
    const email = user?.email;
    if (!email) return fallback;
    const match = email.match(/(\d{4})/);
    return match ? `Class of ${match[1]}` : fallback;
  }, [user?.email]);

  const isAdmin = useMemo(() => {
    const email = user?.email?.toLowerCase();
    if (!email) return false;
    return ADMIN_EMAILS.includes(email);
  }, [user?.email]);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, logOut, classYear, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
