import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const providers = [
  { id: "google", label: "Google" },
  { id: "github", label: "GitHub" },
] as const;

export function OAuthButtons() {
  async function handleOAuth(provider: "google" | "github") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/app/dashboard` },
    });
    if (error) toast.error(error.message);
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {providers.map((p) => (
        <Button key={p.id} variant="outline" onClick={() => handleOAuth(p.id)} type="button">
          {p.label}
        </Button>
      ))}
    </div>
  );
}
