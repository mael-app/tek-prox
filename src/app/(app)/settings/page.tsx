import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SshKeyForm } from "@/components/settings/ssh-key-form";

export default function SettingsPage() {
  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

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
    </div>
  );
}
