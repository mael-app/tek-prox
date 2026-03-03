import { TemplatesClient } from "@/components/admin/templates-client";

export default function AdminTemplatesPage() {

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">OS Templates</h1>
      <p className="text-muted-foreground mb-6">
        Manage the OS templates available when creating new instances.
      </p>
      <TemplatesClient />
    </div>
  );
}
