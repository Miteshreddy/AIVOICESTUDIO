import { create } from "zustand";
import { persist } from "zustand/middleware";

interface NotificationPrefs {
  generationComplete: boolean;
  cloneReady: boolean;
  weeklyDigest: boolean;
  productUpdates: boolean;
}

interface SettingsState {
  language: string;
  notifications: NotificationPrefs;
  setLanguage: (lang: string) => void;
  toggleNotification: (key: keyof NotificationPrefs) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      language: "English (US)",
      notifications: {
        generationComplete: true,
        cloneReady: true,
        weeklyDigest: false,
        productUpdates: true,
      },
      setLanguage: (lang) => set({ language: lang }),
      toggleNotification: (key) =>
        set({ notifications: { ...get().notifications, [key]: !get().notifications[key] } }),
    }),
    { name: "voice-studio-settings" },
  ),
);
