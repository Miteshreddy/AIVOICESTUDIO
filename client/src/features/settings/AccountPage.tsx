import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LogOut, Loader2, Save } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SettingsSection } from "./components/SettingsSection";
import { useAuthStore } from "@/store/auth-store";
import { supabase } from "@/lib/supabase";

export default function AccountPage() {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState((user?.user_metadata?.full_name as string) ?? "");
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const initials = (user?.email ?? "VS").slice(0, 2).toUpperCase();

  async function handleSaveProfile() {
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: fullName } });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profile updated.");
  }

  async function handleUpdatePassword() {
    if (newPassword.length < 6) {
      toast.warning("Password must be at least 6 characters.");
      return;
    }
    setUpdatingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setUpdatingPassword(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Password updated.");
      setNewPassword("");
    }
  }

  return (
    <div className="container max-w-2xl space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your profile and account security.</p>
      </div>

      <SettingsSection title="Profile">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user?.user_metadata?.avatar_url} loading="lazy" />
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="text-sm font-medium">{user?.email}</p>
            <p className="text-xs text-muted-foreground">
              Joined {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
            </p>
          </div>
        </div>

        <div className="space-y-1.5 pt-2">
          <Label htmlFor="full-name" className="text-xs">
            Full name
          </Label>
          <Input id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" onClick={handleSaveProfile} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save profile
        </Button>
      </SettingsSection>

      <SettingsSection title="Password">
        <div className="space-y-1.5">
          <Label htmlFor="new-password" className="text-xs">
            New password
          </Label>
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleUpdatePassword} disabled={updatingPassword}>
          {updatingPassword && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Update password
        </Button>
      </SettingsSection>

      <SettingsSection title="Session">
        <Button variant="outline" size="sm" onClick={() => signOut().then(() => navigate("/"))}>
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </Button>
      </SettingsSection>

      <SettingsSection title="Danger Zone">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm">
              Delete account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                This permanently deletes all voices, projects, and generated audio. This action
                cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="destructive"
                onClick={() => toast.info("Account deletion requires backend confirmation — not yet connected.")}
              >
                Yes, delete my account
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SettingsSection>
    </div>
  );
}
