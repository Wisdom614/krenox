"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type UserRole = "super_admin" | "tenant_admin" | "staff" | "admin" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole;
  loading: boolean;
  organisationId: string | null;
  organisationName: string | null;
  displayName: string;
  dashboardRoute: string;
  signIn: (email: string, password: string) => Promise<{ user: User; role: UserRole; dashboardRoute: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  loading: true,
  organisationId: null,
  organisationName: null,
  displayName: "Staff Member",
  dashboardRoute: "/staff",
  signIn: async () => {
    throw new Error("AuthProvider not mounted");
  },
  signOut: async () => {},
});

// Module-level token holder for api.ts requests
let currentAccessToken: string | null = null;

export function getStoredAccessToken(): string | null {
  if (currentAccessToken) return currentAccessToken;
  if (typeof window !== "undefined") {
    return localStorage.getItem("krenox_auth_token");
  }
  return null;
}

export function setStoredAccessToken(token: string | null) {
  currentAccessToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem("krenox_auth_token", token);
    } else {
      localStorage.removeItem("krenox_auth_token");
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  const extractRole = (u: User | null): UserRole => {
    if (!u) return null;
    const r = u.user_metadata?.role;
    const orgId = u.user_metadata?.organisation_id;

    // Tenant administrator: explicitly tenant_admin, or admin with an organisation_id attached
    if (r === "tenant_admin" || (r === "admin" && orgId)) {
      return "tenant_admin";
    }
    // Platform super administrator (platform owner review console)
    if (r === "super_admin" || (r === "admin" && !orgId)) {
      return "super_admin";
    }
    if (r === "staff") {
      return "staff";
    }
    return "staff";
  };

  const getDashboardRouteForRole = (r: UserRole): string => {
    if (r === "super_admin") return "/admin";
    if (r === "tenant_admin") return "/tenant-admin";
    return "/staff";
  };

  const organisationId = user?.user_metadata?.organisation_id || null;
  const organisationName = user?.user_metadata?.organisation_name || null;
  const displayName =
    user?.user_metadata?.contact_name ||
    user?.user_metadata?.name ||
    (user?.email ? user.email.split("@")[0] : "Staff Member");
  const dashboardRoute = getDashboardRouteForRole(role);

  useEffect(() => {
    let active = true;

    // 1. Fetch initial session
    supabase.auth.getSession().then(({ data: { session: initSession } }) => {
      if (active) {
        setSession(initSession);
        setUser(initSession?.user ?? null);
        const r = extractRole(initSession?.user ?? null);
        setRole(r);
        setStoredAccessToken(initSession?.access_token ?? null);
        setLoading(false);
      }
    });

    // 2. Listen to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (active) {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        const r = extractRole(newSession?.user ?? null);
        setRole(r);
        setStoredAccessToken(newSession?.access_token ?? null);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setLoading(false);
      throw new Error(error.message || "Failed to sign in. Verify your credentials.");
    }

    if (!data.user || !data.session) {
      setLoading(false);
      throw new Error("No session returned from authentication server.");
    }

    const assignedRole = extractRole(data.user);
    const targetRoute = getDashboardRouteForRole(assignedRole);
    setUser(data.user);
    setSession(data.session);
    setRole(assignedRole);
    setStoredAccessToken(data.session.access_token);
    setLoading(false);

    return { user: data.user, role: assignedRole, dashboardRoute: targetRoute };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setStoredAccessToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        loading,
        organisationId,
        organisationName,
        displayName,
        dashboardRoute,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

