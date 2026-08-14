"use client";

import { createContext, useContext, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useRouter } from "next/navigation";

// @ts-ignore
import { logout } from "@/actions/auth";

interface CustomUser {
  id?: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  is_staff?: boolean;
}

interface AuthContextValue {
  user: CustomUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
  classYear: string;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Read state from Redux store
  const user = useSelector((state: any) => state.auth.user);
  const isAuthenticated = useSelector((state: any) => state.auth.isAuthenticated);

  // loading is true while isAuthenticated is null (undetermined)
  const loading = isAuthenticated === null;

  const dispatch = useDispatch();
  const router = useRouter();

  const signIn = async () => {
    // Redirect to the login page
    router.push("/login");
  };

  const logOut = async () => {
    // Dispatch Redux logout action
    dispatch(logout() as any);
  };

  const classYear = useMemo(() => {
    const fallback = "Class of 2027";
    const email = user?.email;
    if (!email) return fallback;
    const match = email.match(/(\d{4})/);
    return match ? `Class of ${match[1]}` : fallback;
  }, [user?.email]);

  const isAdmin = useMemo(() => !!user?.is_staff, [user?.is_staff]);

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
