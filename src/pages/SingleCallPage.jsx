import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/AuthContext';
import { getAgentInstance, getAssistants, getProspects, getVoiceCampaigns, initiateSmartsdrCall, listAvailableAgentTypes } from '@/lib/api';
import { canConfigureAgents, canCreateCampaigns, isSharedMode } from '@/lib/rbac';
import { REFUSALS } from '@/lib/campaignRefusals';

/**
 * One manual call. With shared assistants on, the shared Outbound SDR places it (no tenant assistant is sent): it is
 * available while the tenant may use Outbound SDR and (for those who can read it) its agent setup is published.
 * With shared assistants off, the call uses one of the tenant's own live assistants, as before.
 */
export default function SingleCallPage() {
  const { user } = useAuth();
  const sharedMode = isSharedMode(user);
  const [assistants, setAssistants] = useState([]);
  // shared mode: null while checking, { ok, reason } after.
  const [readiness, setReadiness] = useState(null);
  const [prospects, setProspects] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [assistantId, setAssistantId] = useState('');
  const [prospectId, setProspectId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [purposeMode, setPurposeMode] = useState('default');
  const [campaignId, setCampaignId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [busy, setBusy] = useState(false);
  const [callError, setCallError] = useState(null);

  useEffect(() => {
    Promise.allSettled([getProspects({ limit: 1000 }), getVoiceCampaigns()]).then(([p, c]) => {
      if (p.status === 'fulfilled') setProspects(p.value.data?.prospects || []);
      if (c.status === 'fulfilled') setCampaigns(c.value.data?.campaigns || c.value.data || []);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!sharedMode) {
      getAssistants().then((r) => {
        if (cancelled) return;
        const live = (r.data || []).filter((row) => row.vapi_assistant_id && row.is_live !== false);
        setAssistants(live);
        setAssistantId((current) => current || live[0]?.vapi_assistant_id || '');
      }).catch(() => { if (!cancelled) setAssistants([]); });
      return () => { cancelled = true; };
    }
    (async () => {
      try {
        const types = (await listAvailableAgentTypes()).data || [];
        const outbound = types.find((row) => (row.agent_type || row.key) === 'sdr_outbound' || row.key === 'sdr');
        if (!outbound?.usable) { if (!cancelled) setReadiness({ ok: false, reason: 'not_in_plan' }); return; }
        if (canConfigureAgents(user)) {
          let published = false;
          try { published = (await getAgentInstance('sdr_outbound')).data?.published_version != null; } catch { published = false; }
          if (!published) { if (!cancelled) setReadiness({ ok: false, reason: 'not_published' }); return; }
        }
        if (!cancelled) setReadiness({ ok: true });
      } catch {
        if (!cancelled) setReadiness({ ok: false, reason: 'unknown' });
      }
    })();
    return () => { cancelled = true; };
  }, [sharedMode, user]);

  const ready = sharedMode ? Boolean(readiness?.ok) : Boolean(assistantId);
  // A chosen campaign or a typed purpose must be filled before calling.
  const purposeReady = purposeMode === 'campaign' ? Boolean(campaignId)
    : purposeMode === 'custom' ? Boolean(purpose.trim()) : true;

  const submit = async (event) => {
    event.preventDefault();
    if (!phone.trim() || !name.trim() || !ready || !purposeReady) return;
    setBusy(true);
    setCallError(null);
    try {
      await initiateSmartsdrCall({ phone_number: phone.trim(), user_name: name.trim(),
        assistant_id: sharedMode ? undefined : assistantId, prospect_id: prospectId || undefined,
        campaign_id: purposeMode === 'campaign' ? campaignId : undefined,
        purpose: purposeMode === 'custom' ? purpose.trim() : undefined });
      toast.success('Call started. It will appear in Call logs.');
    } catch (error) {
      const response = error.response?.data || {};
      const detail = response.detail;
      const code = response.code || (detail && typeof detail === 'object' ? detail.code : null);
      const refusal = REFUSALS[code];
      const fix = refusal?.fix(user);
      const message = response.message || (typeof detail === 'string' ? detail : null) || 'Could not start the call.';
      setCallError({ title: refusal?.title || null, message, fix });
      toast.error(refusal?.title || message);
    } finally { setBusy(false); }
  };

  if (!canCreateCampaigns(user)) return <p className="rounded-xl border p-5">You don't have access to place calls.</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div><h1 className="text-2xl font-bold">Single call</h1><p className="mt-1 text-sm text-muted-foreground">{sharedMode ? 'Place one call with your Outbound SDR agent.' : 'Place one call with one of your assistants.'}</p></div>
      <form className="space-y-5 rounded-2xl border bg-card p-6" onSubmit={submit}>
        {callError && <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          {callError.title && <p className="font-semibold">{callError.title}</p>}
          <p>{callError.message}</p>
          {callError.fix?.to ? <Link className="mt-1 inline-block font-semibold underline" to={callError.fix.to}>{callError.fix.label}</Link>
            : callError.fix?.label && <p className="mt-1">{callError.fix.label}</p>}
        </div>}
        <label className="block space-y-1 text-sm font-medium">Prospect
          <select className="w-full rounded-md border bg-background px-3 py-2" value={prospectId} onChange={(e) => {
            const row = prospects.find((item) => String(item.prospect_id || item.id) === e.target.value);
            setProspectId(e.target.value); setName(row?.full_name || row?.name || ''); setPhone(row?.phone || row?.phone_number || '');
          }}><option value="">Enter details manually</option>{prospects.map((row) => <option key={row.prospect_id || row.id} value={row.prospect_id || row.id}>{row.full_name || row.name || row.phone}</option>)}</select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium">Name<Input required value={name} onChange={(e) => { setName(e.target.value); setProspectId(''); }} /></label>
          <label className="space-y-1 text-sm font-medium">Phone number<Input required type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setProspectId(''); }} /></label>
        </div>
        <fieldset className="space-y-3"><legend className="text-sm font-semibold">Call purpose</legend>
          <label className="flex items-center gap-2 text-sm"><input type="radio" name="purpose" checked={purposeMode === 'default'} onChange={() => setPurposeMode('default')} /> Use the agent's default call reason</label>
          <label className="flex items-center gap-2 text-sm"><input type="radio" name="purpose" checked={purposeMode === 'campaign'} onChange={() => setPurposeMode('campaign')} /> Use an existing campaign's pitch</label>
          {purposeMode === 'campaign' && <select aria-label="Campaign" className="w-full rounded-md border bg-background px-3 py-2" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}><option value="">Choose a campaign</option>{campaigns.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>}
          {sharedMode && <label className="flex items-center gap-2 text-sm"><input type="radio" name="purpose" checked={purposeMode === 'custom'} onChange={() => setPurposeMode('custom')} /> Use a short purpose</label>}
          {sharedMode && purposeMode === 'custom' && <Input aria-label="Short purpose" maxLength={300} placeholder="One sentence: why the agent is calling" value={purpose} onChange={(e) => setPurpose(e.target.value)} />}
          {purposeMode === 'default' && sharedMode && <p className="text-xs text-muted-foreground">The agent says its default call reason (Agent identity → Default call reason).</p>}
          {purposeMode === 'campaign' && <p className="text-xs text-muted-foreground">The call uses this campaign's pitch and purpose but isn't counted as one of its calls.</p>}
        </fieldset>
        {!sharedMode && (
          <label className="block space-y-1 text-sm font-medium">Assistant
            <select className="w-full rounded-md border bg-background px-3 py-2" value={assistantId} onChange={(e) => setAssistantId(e.target.value)}>
              <option value="">{assistants.length ? 'Choose an assistant' : 'No live assistants'}</option>
              {assistants.map((row) => <option key={row.vapi_assistant_id} value={row.vapi_assistant_id}>{row.name}</option>)}
            </select>
          </label>
        )}
        <div className="flex items-center justify-between gap-4"><Button type="submit" disabled={busy || !ready || !purposeReady}>{busy ? 'Starting call…' : sharedMode ? 'Call with Outbound SDR' : 'Start call'}</Button><Link className="text-sm underline" to="/call-logs">View call logs</Link></div>
        {sharedMode && readiness && !readiness.ok && (
          <p role="status" className="text-sm text-muted-foreground">
            {readiness.reason === 'not_published'
              ? <>Publish your Outbound SDR agent first. <Link className="underline" to="/agents/sdr_outbound">Set up Outbound SDR</Link></>
              : readiness.reason === 'not_in_plan' ? "Outbound SDR isn't in your plan. Ask your Tenant Admin."
                : "Calling couldn't be checked right now. Refresh to try again."}
          </p>
        )}
        {!sharedMode && assistants.length === 0 && <p role="status" className="text-sm text-muted-foreground">No live assistant is available to call with.</p>}
      </form>
    </div>
  );
}
