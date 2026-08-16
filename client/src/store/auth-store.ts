import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthState {
  user: User | null;
  session: Session | null;
  status: "loading" | "authenticated" | "unauthenticated";
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  status: "loading",
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, status: "unauthenticated" });
  },
}));

supabase.auth.getSession().then(({ data: { session } }) => {
  useAuthStore.setState({
    session,
    user: session?.user ?? null,
    status: session ? "authenticated" : "unauthenticated",
  });
});

supabase.auth.onAuthStateChange((_event, session) => {
  useAuthStore.setState({
    session,
    user: session?.user ?? null,
    status: session ? "authenticated" : "unauthenticated",
  });
});
