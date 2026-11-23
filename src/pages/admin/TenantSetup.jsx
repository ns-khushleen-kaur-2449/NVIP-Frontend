import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Building2, Check, Loader2, UserPlus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { TenantSettingsPanel } from '@/components/admin/TenantSettingsDialog';
import { InvitationsList, InviteDialog } from '@/components/admin/Invitations';
import ReadinessList from '@/components/admin/ReadinessList';
import { errorText } from '@/components/admin/userBits';
import { PhoneNumbersPanel, PlanCell } from '@/pages/admin/Tenants';
import {
  createTenant, getTenantOnboarding, getTenantReadiness, getToolTenants, listTools, saveTenantOnboarding,
  setManyToolsTenants,
} from '@/lib/api';

export const STEPS = [
  { key: 'details', label: 'Tenant details' },
  { key: 'admin', label: 'First admin' },
  { key: 'settings', label: 'Features and limits' },
  { key: 'phone', label: 'Phone number' },
  { key: 'tools', label: 'Tool grants' },
  { key: 'review', label: 'Review' },
];
const KEYS = STEPS.map((s) => s.key);
const nextOf = (key) => KEYS[Math.min(KEYS.indexOf(key) + 1, KEYS.length - 1)];
const prevOf = (key) => KEYS[Math.max(KEYS.indexOf(key) - 1, 0)];
// A Super Admin can open the platform pages only; a tenant's own pages are named, not linked.
const adminLink = (fix) => fix.by === 'super_admin' && fix.path?.startsWith('/admin');

/** Read-only: the tenant buys its plan itself (Stripe billing); nothing here changes it. */
function PlanNote({ plan }) {
  return (
    <div className="rounded-lg border border-border p-3 text-sm" data-testid="setup-plan">
      <p className="text-xs font-medium text-muted-foreground mb-1">Plan</p>
      <PlanCell plan={plan} />
      <p className="text-xs text-muted-foreground mt-1">The organisation buys its plan in Billing. It can't be changed here.</p>
    </div>
  );
}

function DetailsStep({ info, onCreated }) {
  const [form, setForm] = useState({ name: '', default_timezone: 'Asia/Kolkata' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  if (info) {
    return (
      <div className="space-y-3">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-xs text-muted-foreground">Name</dt><dd className="font-medium">{info.name}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Default time zone</dt><dd>{info.default_timezone}</dd></div>
        </dl>
        <p className="text-xs text-muted-foreground">The organisation is created. Continue with its first admin.</p>
        <PlanNote plan={info.plan} />
      </div>
    );
  }
  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) { setError('A tenant name is required'); return; }
    setSaving(true); setError(null);
    try {
      const res = await createTenant({ name: form.name.trim(), default_timezone: form.default_timezone.trim() || 'Asia/Kolkata',
        start_onboarding: true });
      onCreated(res.data.tenant_id);
    } catch (e) {
      setError(errorText(e, 'Could not create the tenant'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-3 max-w-md">
      <label className="block text-sm font-medium">Tenant name
        <Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </label>
      <label className="block text-sm font-medium">Default time zone
        <Input className="mt-1" value={form.default_timezone} onChange={(e) => setForm({ ...form, default_timezone: e.target.value })} />
      </label>
      <p className="text-xs text-muted-foreground">Creating it saves straight away; you can leave and continue the setup later.</p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Create tenant</Button>
    </form>
  );
}

function AdminStep({ info }) {
  const [inviting, setInviting] = useState(false);
  const [key, setKey] = useState(0);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Invite the organisation's Tenant Admin. No email is sent: copy the link and
        share it by hand. They choose their own password.</p>
      <Button size="sm" onClick={() => setInviting(true)}><UserPlus className="w-4 h-4 mr-1" /> Invite Tenant Admin</Button>
      <InvitationsList tenantId={info.tenant_id} refreshKey={key} />
      <InviteDialog open={inviting} onOpenChange={setInviting} roles={['tenant_admin']} tenantId={info.tenant_id}
        title={`Invite the Tenant Admin of ${info.name}`} onInvited={() => setKey((k) => k + 1)} />
    </div>
  );
}

/** Grants for this tenant through the bulk Tenant access route (the Tools page's): tick tools, give a reason. */
export function ToolGrantsStep({ info }) {
  const [tools, setTools] = useState(null);
  const [hint, setHint] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = (await listTools()).data || [];
      const granted = await Promise.all(list.map((tool) => Promise.resolve().then(() => getToolTenants(tool.id))
        .then((r) => Boolean(r?.data?.tenants?.find((t) => t.tenant_id === info.tenant_id)?.granted)).catch(() => false)));
      setTools(list.map((tool, i) => ({ ...tool, granted: granted[i] })));
    } catch (e) {
      toast.error(errorText(e, 'Could not load the tools'));
      setTools([]);
    }
    Promise.resolve().then(() => getTenantReadiness(info.tenant_id))
      .then((r) => setHint((r?.data?.items || []).find((i) => i.key === 'tool_grants' && i.status === 'missing') || null))
      .catch(() => setHint(null));
  }, [info.tenant_id]);
  useEffect(() => { load(); }, [load]);

  const toggle = (id, on) => setSelected((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  const give = async () => {
    setSaving(true);
    try {
      const res = await setManyToolsTenants([...selected], [info.tenant_id], true, reason.trim());
      const failed = (res.data?.tools || []).reduce((n, t) => n + (t.detach_errors?.length || 0), 0);
      if (failed) toast.warning(`Access given, but Vapi did not update ${failed} agent(s). Run tool sync for this tenant.`);
      else toast.success(`Access given on ${selected.size} tool(s)`);
      setSelected(new Set()); setReason('');
      await load();
    } catch (e) {
      toast.error(errorText(e, 'Could not give access'));
    } finally {
      setSaving(false);
    }
  };

  if (!tools) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  return (
    <div className="space-y-3">
      {hint && <p className="text-sm text-amber-700" data-testid="tool-grants-hint">{hint.message}</p>}
      {tools.length === 0 ? <p className="text-sm text-muted-foreground">No tools yet (Tools page).</p> : (
        <div className="max-h-80 overflow-y-auto divide-y divide-border rounded-lg border border-border">
          {tools.map((tool) => (
            <label key={tool.id} className="flex items-center gap-3 px-3 py-2.5 text-sm" data-testid={`setup-tool-${tool.id}`}>
              <Checkbox aria-label={tool.name} disabled={tool.granted} checked={tool.granted || selected.has(tool.id)}
                onCheckedChange={(v) => toggle(tool.id, Boolean(v))} />
              <span className="flex-1">{tool.name}<span className="block text-xs text-muted-foreground">{tool.type_key}</span></span>
              {tool.granted && <Badge variant="outline" className="text-[11px]">Granted</Badge>}
            </label>
          ))}
        </div>
      )}
      <label className="block text-xs font-medium text-muted-foreground">Reason for giving access
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} rows={2} className="mt-1" />
      </label>
      <Button onClick={give} disabled={saving || !selected.size || reason.trim().length < 3}>
        {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Give access
      </Button>
      <p className="text-xs text-muted-foreground">To remove access, use Tools → Tenant access.</p>
    </div>
  );
}

function ReviewStep({ info }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    Promise.resolve().then(() => getTenantReadiness(info.tenant_id)).then((r) => setItems(r?.data?.items || []))
      .catch((e) => { toast.error(errorText(e, 'Could not load readiness')); setItems([]); });
  }, [info.tenant_id]);
  return (
    <div className="space-y-3">
      <PlanNote plan={info.plan} />
      {!items ? <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        : <ReadinessList items={items} linkable={adminLink} />}
      <p className="text-xs text-muted-foreground">Items for the Tenant Admin show on their own dashboard once they join.</p>
    </div>
  );
}

/**
 * Super Admin: set up a new organisation step by step. Each step saves straight away through its own (audited)
 * routes; the wizard records where it is (`tenants.onboarding`), so "Continue setup" on the Tenants page resumes it.
 * `/admin/tenants/new` starts it; `/admin/tenants/:tenantId/setup` resumes it (`?step=review` opens a step).
 */
export default function TenantSetupPage() {
  const { tenantId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [step, setStep] = useState('details');
  const [completed, setCompleted] = useState([]);
  const [error, setError] = useState(null);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (!tenantId) { setInfo(null); setStep('details'); setCompleted([]); return; }
    setError(null);
    getTenantOnboarding(tenantId).then((r) => {
      setInfo(r.data);
      const asked = params.get('step');
      setStep(KEYS.includes(asked) ? asked : r.data.onboarding?.step || 'admin');
      setCompleted(r.data.onboarding?.completed || ['details']);
    }).catch((e) => setError(errorText(e, 'Could not load this tenant')));
  }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Record the move (and, with `done`, the current step as done), then show the step. */
  const go = async (target, done = false) => {
    const nextDone = done ? [...new Set([...completed, step])] : completed;
    setMoving(true);
    try {
      const saved = (await saveTenantOnboarding(info.tenant_id, target, nextDone)).data;
      setCompleted(saved?.completed || nextDone);
      if (done && step === 'review') {
        toast.success(`${info.name}: setup finished`);
        navigate('/admin/tenants');
        return;
      }
      setStep(target);
    } catch (e) {
      toast.error(errorText(e, 'Could not save the setup progress'));
    } finally {
      setMoving(false);
    }
  };

  if (error) return <div className="max-w-4xl mx-auto"><p role="alert" className="text-sm text-red-600">{error}</p></div>;
  if (tenantId && !info) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  const title = STEPS.find((s) => s.key === step)?.label;
  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="tenant-setup">
      <div>
        <Link to="/admin/tenants" className="text-xs text-muted-foreground inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> Tenants</Link>
        <h1 className="font-display text-2xl font-semibold flex items-center gap-2 mt-1">
          <Building2 className="w-6 h-6 text-primary" /> {info ? `Set up ${info.name}` : 'New tenant'}
        </h1>
      </div>
      <ol className="flex flex-wrap gap-2" aria-label="Setup steps">
        {STEPS.map((s, i) => {
          const done = completed.includes(s.key);
          const current = s.key === step;
          return (
            <li key={s.key}>
              <button type="button" disabled={!info || moving || current} onClick={() => go(s.key)}
                aria-current={current ? 'step' : undefined}
                className={`rounded-full border px-3 py-1 text-xs font-medium inline-flex items-center gap-1 disabled:cursor-default ${current ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}>
                {done ? <Check className="w-3 h-3" aria-label="done" /> : <span>{i + 1}.</span>} {s.label}
              </button>
            </li>
          );
        })}
      </ol>
      <Card className="card-base p-5 space-y-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        {step === 'details' && <DetailsStep info={info} onCreated={(id) => navigate(`/admin/tenants/${id}/setup`, { replace: true })} />}
        {step === 'admin' && info && <AdminStep info={info} />}
        {step === 'settings' && info && <TenantSettingsPanel tenant={info} hideAdmins />}
        {step === 'phone' && info && <PhoneNumbersPanel tenant={info} />}
        {step === 'tools' && info && <ToolGrantsStep info={info} />}
        {step === 'review' && info && <ReviewStep info={info} />}
        {info && (
          <div className="flex justify-between pt-2 border-t border-border">
            <Button variant="outline" disabled={moving || step === 'details'} onClick={() => go(prevOf(step))}>Back</Button>
            <Button disabled={moving} onClick={() => go(step === 'review' ? 'review' : nextOf(step), true)}>
              {moving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} {step === 'review' ? 'Finish setup' : 'Continue'}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
