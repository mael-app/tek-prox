import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SshKeyForm } from "@/components/settings/ssh-key-form";
import { ForceLogoutButton } from "@/components/settings/force-logout-button";

export default function SettingsPage() {
  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>SSH Public Key</CardTitle>
          <p className="text-sm text-muted-foreground">
            Used when activating SSH access on your instances.
          </p>
        </CardHeader>
        <CardContent>
          <SshKeyForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <p className="text-sm text-muted-foreground">
            Invalidate all active sessions. You will be signed out immediately.
          </p>
        </CardHeader>
        <CardContent>
          <ForceLogoutButton />
        </CardContent>
      </Card>
    </div>
  );
}
