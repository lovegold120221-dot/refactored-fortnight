"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type UserProfile = {
  id: string;
  name: string;
  theme: "light" | "dark";
  default_language: string;
  voice: string;
};

type UserContextType = {
  profile: UserProfile | null;
  loading: boolean;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        // 1. Get or create a local anonymous ID
        let userId = window.localStorage.getItem("orbitUserId");
        if (!userId) {
          userId = crypto.randomUUID();
          window.localStorage.setItem("orbitUserId", userId);
        }

        // 2. Fetch from Supabase
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (error && error.code !== "PGRST116") {
          console.error("Error fetching profile:", error);
        }

        if (data) {
          setProfile(data);
          document.documentElement.dataset.theme = data.theme || "dark";
        } else {
          // Default profile if none exists
          const defaultProfile: UserProfile = {
            id: userId,
            name: "",
            theme: "dark",
            default_language: "en",
            voice: "Orus",
          };
          setProfile(defaultProfile);
          
          // Attempt to insert (might fail if table doesn't exist yet, which is fine)
          try { await supabase.from("profiles").upsert(defaultProfile); } catch { /* table may not exist */ }
        }
      } catch (err) {
        console.error("Failed to load user profile:", err);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!profile) return;
    const newProfile = { ...profile, ...updates };
    setProfile(newProfile);

    if (updates.theme) {
      document.documentElement.dataset.theme = updates.theme;
      window.localStorage.setItem("orbit.theme", updates.theme);
    }

    try {
      await supabase.from("profiles").upsert(newProfile);
    } catch (err) {
      console.error("Failed to sync profile update to Supabase:", err);
    }
  };

  return (
    <UserContext.Provider value={{ profile, loading, updateProfile }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
