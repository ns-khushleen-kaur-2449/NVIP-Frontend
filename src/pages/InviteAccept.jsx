import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2, UserPlus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { acceptInvitation, getInvitation } from '@/lib/api';
import { roleLabel } from '@/lib/rbac';

const PASSWORD_RULE = 'At least 8 characters, with a lowercase letter, an uppercase letter, a number and a special character.';

/** Keep the invite link (it carries the token) out of any Referer header while this page is open. */
function useNoReferrer() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);
}

function Shell({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4" data-testid="invite-page">
      <Card className="card-base w-full max-w-md p-6 space-y-4">{children}</Card>
    </div>
  );
}

/** Public: open an invite link, set a password, join.  Used, cancelled and expired links get their own message. */
export default function InviteAcceptPage() {
  useNoReferrer();
  const { token } = useParams();
  const [invite, setInvite] = useState(null);
  const [problem, setProblem] = useState(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [joined, setJoined] = useState(null);

  useEffect(() => {
    getInvitation(token)
      .then((res) => setInvite(res.data))
      .catch((e) => setProblem(e?.response?.data?.detail?.message || 'This invite link is not valid.'));
  }, [token]);

  const submit = async (event) => {
    event.preventDefault();
    if (password !== confirm) { setError("The passwords don't match."); return; }
    setSaving(true); setError(null);
    try {
      setJoined((await acceptInvitation(token, password)).data);
    } catch (e) {
      const detail = e?.response?.data?.detail;
      if (e?.response?.status === 410 || e?.response?.status === 404) setProblem(detail?.message || 'This invite link is not valid.');
      else setError(typeof detail === 'string' ? detail : 'Could not create your account.');
    } finally {
      setSaving(false);
    }
  };

  if (problem) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">Invite link</h1>
        <p role="alert" className="text-sm">{problem}</p>
        <Link className="text-sm underline" to="/login">Go to sign in</Link>
      </Shell>
    );
  }
  if (joined) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">You're in</h1>
        <p className="text-sm">{joined.message}</p>
        <Button asChild><Link to="/login">Sign in</Link></Button>
      </Shell>
    );
  }
  if (!invite) return <Shell><div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div></Shell>;
  return (
    <Shell>
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2"><UserPlus className="w-5 h-5 text-primary" /> Join {invite.tenant_name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {invite.name}, you've been invited as {roleLabel(invite.role)}. Choose a password for {invite.email}.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm font-medium">Password
          <Input className="mt-1" type="password" required autoComplete="new-password" value={password}
            onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="block text-sm font-medium">Confirm password
          <Input className="mt-1" type="password" required autoComplete="new-password" value={confirm}
            onChange={(e) => setConfirm(e.target.value)} />
        </label>
        <p className="text-xs text-muted-foreground">{PASSWORD_RULE}</p>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Create my account
        </Button>
      </form>
    </Shell>
  );
}
