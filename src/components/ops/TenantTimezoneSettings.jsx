import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import TimezoneSelect from '@/components/shared/TimezoneSelect';
import { errorText } from '@/components/admin/userBits';
import { useAuth } from '@/lib/AuthContext';
import { updateOwnTenantTimezone } from '@/lib/api';

/** Tenant Admin: the organisation's default timezone (PUT /api/v1/tenant-timezone). */
export default function TenantTimezoneSettings() {
  const { user, refreshMe } = useAuth();
  const stored = user?.tenant?.default_timezone || '';
  const [zone, setZone] = useState(stored);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { setZone(stored); }, [stored]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateOwnTenantTimezone(zone);
      toast.success('Time zone saved');
      // /api/auth/me carries the tenant's timezone: new campaigns and every screen pick up the new one.
      await refreshMe?.();
    } catch (e) {
      setError(errorText(e, 'Could not save the time zone'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="card-base p-5 space-y-3" data-testid="tenant-timezone-settings">
      <h2 className="text-sm font-semibold">Organisation time zone</h2>
      <div className="max-w-md space-y-1">
        <TimezoneSelect aria-label="Organisation time zone" required value={zone} onChange={setZone}
          aria-invalid={Boolean(error) || undefined} />
        <p className="text-xs text-muted-foreground">
          New campaigns start in this time zone. Changing it doesn't change existing campaigns.
        </p>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </div>
      <Button onClick={save} disabled={saving || !zone || zone === stored} className="bg-primary text-primary-foreground">
        {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Save time zone
      </Button>
    </Card>
  );
}
