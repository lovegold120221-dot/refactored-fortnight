"use client";

import { useUser } from "@/context/UserContext";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { PICKER_LANGUAGES } from "@/lib/languages";

export default function SettingsPage() {
  const router = useRouter();
  const { profile, loading, updateProfile } = useUser();
  const [saving, setSaving] = useState(false);

  // Local state for forms
  const [name, setName] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [defaultLanguage, setDefaultLanguage] = useState("en");
  const [voice, setVoice] = useState("Orus");

  useEffect(() => {
    if (profile) {
      const t = setTimeout(() => {
        setName(profile.name || "");
        setTheme(profile.theme || "dark");
        setDefaultLanguage(profile.default_language || "en");
        setVoice(profile.voice || "Orus");
      }, 0);
      return () => clearTimeout(t);
    }
  }, [profile]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await updateProfile({
      name,
      theme,
      default_language: defaultLanguage,
      voice,
    });
    setSaving(false);
    // Go back after save
    router.back();
  }

  if (loading) {
    return (
      <main className="entry-shell" data-theme="dark">
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
          Loading your settings...
        </div>
      </main>
    );
  }

  return (
    <main className="entry-shell" data-theme={theme}>
      <section className="entry-main" style={{ alignItems: "center", justifyContent: "center" }}>
        <div className="entry-content" style={{ width: "100%", maxWidth: "500px", padding: "40px" }}>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
            <h2>Orbit Settings</h2>
            <button 
              type="button" 
              onClick={() => router.back()} 
              style={{ background: "transparent", border: "none", color: "var(--fg-secondary)", cursor: "pointer", fontSize: "16px" }}
            >
              Cancel
            </button>
          </div>

          <form className="entry-form" onSubmit={handleSave}>
            
            <label className="entry-field">
              <span>Display Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                maxLength={40}
              />
            </label>

            <label className="entry-field">
              <span>Theme</span>
              <select 
                value={theme} 
                onChange={(e) => setTheme(e.target.value as "light" | "dark")}
                style={{ width: "100%", padding: "12px", borderRadius: "8px", background: "var(--bg-secondary)", color: "var(--fg-primary)", border: "1px solid var(--border)", marginTop: "8px" }}
              >
                <option value="dark">Dark Theme</option>
                <option value="light">Light Theme</option>
              </select>
            </label>

            <label className="entry-field">
              <span>Default Translation Language</span>
              <select 
                value={defaultLanguage} 
                onChange={(e) => setDefaultLanguage(e.target.value)}
                style={{ width: "100%", padding: "12px", borderRadius: "8px", background: "var(--bg-secondary)", color: "var(--fg-primary)", border: "1px solid var(--border)", marginTop: "8px" }}
              >
                {PICKER_LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="entry-field">
              <span>Preferred AI Voice</span>
              <select 
                value={voice} 
                onChange={(e) => setVoice(e.target.value)}
                style={{ width: "100%", padding: "12px", borderRadius: "8px", background: "var(--bg-secondary)", color: "var(--fg-primary)", border: "1px solid var(--border)", marginTop: "8px" }}
              >
                <option value="Orus">Orus (Formal Male)</option>
                <option value="Aoede">Aoede (Female)</option>
                <option value="Kore">Kore</option>
                <option value="Puck">Puck</option>
                <option value="Charon">Charon</option>
                <option value="Fenrir">Fenrir</option>
                <option value="Leda">Leda</option>
              </select>
            </label>

            <button 
              className="entry-primary" 
              type="submit" 
              disabled={saving}
              style={{ marginTop: "24px" }}
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </form>

        </div>
      </section>
    </main>
  );
}
