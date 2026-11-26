import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import TimezoneSelect from '@/components/shared/TimezoneSelect';
import { errorText } from '@/components/admin/userBits';
import { setTenantTimezone } from '@/lib/api';

/** Super Admin: a tenant's default timezone. Needs a reason (admin audit trail); a step-up is asked for when due. */
export default function TenantTimezoneDialog({ tenant, onOpenChange, onSaved }) {
  const [zone, setZone] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const tenantId = tenant?.tenant_id;

  useEffect(() => {
    if (!tenantId) return;
    setZone(tenant.default_timezone || '');
    setReason('');
    setError(null);
  }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  const changed = Boolean(zone) && zone !== (tenant?.default_timezone || '');

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await setTenantTimezone(tenantId, zone, reason.trim());
      toast.success(`Time zone saved for ${tenant.name}`);
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      setError(errorText(e, 'Could not save the time zone'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(tenant)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{tenant ? `Time zone of ${tenant.name}` : ''}</DialogTitle>
          <DialogDescription>
            New campaigns default to it. Existing campaigns, leads, executives and appointments keep their own time zone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="block text-xs font-medium text-muted-foreground">Default time zone
            <TimezoneSelect className="mt-1" aria-label="Default time zone" required value={zone} onChange={setZone}
              aria-invalid={Boolean(error) || undefined} />
          </div>
          <label className="block text-xs font-medium text-muted-foreground">Reason
            <Textarea value={reason} className="mt-1 min-h-[64px]" placeholder="Why? It is kept in the platform audit trail."
              onChange={(e) => setReason(e.target.value)} />
          </label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || !changed || reason.trim().length < 3}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
