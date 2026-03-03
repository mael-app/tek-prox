import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "@/components/admin/settings-form";

export default function AdminSettingsPage() {

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Infrastructure Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Proxmox Defaults</CardTitle>
          <p className="text-sm text-muted-foreground">
            Default storage pool and network bridge used when creating new instances.
          </p>
        </CardHeader>
        <CardContent>
          <SettingsForm />
        </CardContent>
      </Card>
    </div>
  );
}
