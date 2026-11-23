import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { errorText } from '@/components/admin/userBits';
import {
  createInvitation, createTenantInvitation, listInvitations, listTenantInvitations, resendInvitation,
  resendTenantInvitation, revokeInvitation, revokeTenantInvitation,
} from '@/lib/api';
import { roleLabel } from '@/lib/rbac';

/**
 * Invite links: no email is sent. The link is shown once, to copy and share by hand; it works once and expires.
 * With `tenantId` (Super Admin) the calls go to that tenant's admin routes; without it, to the caller's own tenant.
 */
const calls = (tenantId) => (tenantId ? {
  create: (data) => createTenantInvitation(tenantId, data),
  list: () => listTenantInvitations(tenantId),
  resend: (id) => resendTenantInvitation(tenantId, id),
  revoke: (id) => revokeTenantInvitation(tenantId, id),
} : { create: createInvitation, list: listInvitations, resend: resendInvitation, revoke: revokeInvitation });

const STATUS_STYLE = {
  pending: 'bg-amber-500/10 text-amber-600 border-amber-500/25',
  used: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25',
  revoked: 'bg-muted text-muted-foreground',
  expired: 'bg-muted text-muted-foreground',
};
const STATUS_LABELS = { pending: 'Pending', used: 'Joined', revoked: 'Cancelled', expired: 'Expired' };

/** The link, once: copy it now; it is not stored and cannot be shown again. */
export function LinkPanel({ link }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Invite link copied');
    } catch {
      toast.error('Could not copy; select the link and copy it');
    }
  };
  return (
    <div className="space-y-2" data-testid="invite-link">
      <p className="text-sm">Share this link with the person by hand. It works once and expires in 7 days. It is shown
        only now.</p>
      <div className="flex gap-2">
        <Input readOnly value={link} aria-label="Invite link" onFocus={(e) => e.target.select()} />
        <Button type="button" variant="outline" onClick={copy}><Copy className="w-4 h-4 mr-1" /> Copy link</Button>
      </div>
    </div>
  );
}

/** Invite one person: name, email, role.  `roles`: the roles the inviter may give. */
export function InviteDialog({ open, onOpenChange, roles, tenantId, onInvited, title = 'Invite a user' }) {
  const [form, setForm] = useState({ name: '', email: '', role: roles[0] || '' });
  const [link, setLink] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setForm({ name: '', email: '', role: roles[0] || '' }); setLink(null); setError(null); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true); setError(null);
    try {
      const res = await calls(tenantId).create({ name: form.name.trim(), email: form.email.trim(), role: form.role });
      setLink(res.data.link);
      onInvited?.();
    } catch (e) {
      setError(errorText(e, 'Could not create the invite'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]" data-testid="invite-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>No email is sent: you get a link to share. They set their own password.</DialogDescription>
        </DialogHeader>
        {link ? (
          <>
            <LinkPanel link={link} />
            <DialogFooter><Button onClick={() => onOpenChange(false)}>Done</Button></DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <label className="block text-sm font-medium">Name
              <Input className="mt-1" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="block text-sm font-medium">Email
              <Input className="mt-1" required type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            {roles.length > 1 && (
              <label className="block text-sm font-medium">Role
                <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {roles.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                </select>
              </label>
            )}
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Mail className="w-4 h-4 mr-1" />} Create invite link
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The invites list: status, and Resend (a new link; the old one stops working) / Cancel for pending ones. */
export function InvitationsList({ tenantId, refreshKey }) {
  const [rows, setRows] = useState(null);
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      setRows((await calls(tenantId).list()).data);
    } catch (e) {
      toast.error(errorText(e, 'Could not load invites'));
      setRows([]);
    }
  }, [tenantId]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const act = async (row, action) => {
    setBusy(row.id);
    try {
      const res = await calls(tenantId)[action](row.id);
      if (action === 'resend') setLink(res.data.link);
      else toast.success('Invite cancelled');
      await load();
    } catch (e) {
      toast.error(errorText(e, action === 'resend' ? 'Could not resend the invite' : 'Could not cancel the invite'));
    } finally {
      setBusy(null);
    }
  };

  if (!rows) return <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>;
  return (
    <div className="space-y-2" data-testid="invitations-list">
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No invites yet.</p> : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-3 p-3 text-sm" data-testid={`invite-${row.id}`}>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{row.name} <span className="text-muted-foreground font-normal">· {row.email}</span></p>
                <p className="text-xs text-muted-foreground">{roleLabel(row.role)} · expires {new Date(row.expires_at).toLocaleDateString()}</p>
              </div>
              <Badge variant="outline" className={`text-[11px] ${STATUS_STYLE[row.status] || ''}`}>{STATUS_LABELS[row.status] || row.status}</Badge>
              {row.status !== 'used' && (
                <Button variant="outline" size="sm" disabled={busy === row.id} onClick={() => act(row, 'resend')}>Resend</Button>
              )}
              {row.status === 'pending' && (
                <Button variant="ghost" size="sm" className="text-red-600" disabled={busy === row.id}
                  onClick={() => act(row, 'revoke')}>Cancel</Button>
              )}
            </div>
          ))}
        </div>
      )}
      <Dialog open={Boolean(link)} onOpenChange={(open) => !open && setLink(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>New invite link</DialogTitle>
            <DialogDescription>The old link no longer works.</DialogDescription>
          </DialogHeader>
          {link && <LinkPanel link={link} />}
          <DialogFooter><Button onClick={() => setLink(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
