import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye, EyeOff, ArrowLeft, ArrowRight, Mail, LockKeyhole, Info, AudioLines, Activity, ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, MotionConfig } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import HeroWave3D from '@/components/marketing/HeroWave3D';
import ThemeToggle from '@/components/shared/ThemeToggle';
import OrbStage from '@/components/landing/OrbStage';
import { cn } from '@/lib/utils';
import { homePath } from '@/lib/rbac';
import { CodeInput, codeError } from '@/components/auth/MfaParts';

// "Remember me" keeps the email address on this device so the field is filled
// in next time. Sign-in itself always persists (see AuthContext), so this
// never stores the password or the session.
const REMEMBERED_EMAIL_KEY = 'smartsdr_login_email';

const readRememberedEmail = () => {
  try { return localStorage.getItem(REMEMBERED_EMAIL_KEY) || ''; } catch { return ''; }
};
const writeRememberedEmail = (email) => {
  try {
    if (email) localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
    else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
  } catch { /* storage unavailable: nothing to remember */ }
};

// Only what the platform does today (DESIGN.md, The True Claims Rule): no "at scale" or compliance claims.
const FEATURES = [
  { icon: AudioLines, t: 'Voice agents with guardrails', d: 'Consent, do-not-call lists and calling hours are checked before every dial.' },
  { icon: Activity, t: 'Every call on record', d: 'Transcripts, recordings and lead scores for each conversation.' },
  { icon: ShieldCheck, t: 'Your CRM stays in charge', d: 'Leads and outcomes sync to Zoho CRM.' },
];

const EASE_OUT = [0.16, 1, 0.3, 1];

export default function LoginPage() {
  const { login, completeMfaLogin, user, token } = useAuth();
  const navigate = useNavigate();
  const [email,        setEmail]        = useState(readRememberedEmail);
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [remember,     setRemember]     = useState(() => Boolean(readRememberedEmail()));
  const [showResetHelp, setShowResetHelp] = useState(false);
  // A Super Admin's second step: { token } from the password step; recovery: typing a recovery code instead.
  const [mfa, setMfa] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [mfaError, setMfaError] = useState(null);

  useEffect(() => { if (user || token) navigate(homePath(user), { replace: true }); }, [user, token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Please fill in all fields'); return; }
    setLoading(true);
    try {
      const signedIn = await login(email, password);
      writeRememberedEmail(remember ? email.trim() : '');
      if (signedIn?.mfa_required) {
        setMfa({ token: signedIn.mfa_token });
        setPassword('');
        return;
      }
      toast.success('Welcome back!');
      navigate(homePath(signedIn?.user));
    } catch (err) {
      toast.error(err.response?.status === 429 ? 'Too many sign-in attempts. Wait a few minutes, then try again.'
        : err.response?.data?.detail || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMfa = async (e) => {
    e.preventDefault();
    if (!mfaCode.trim()) return;
    setLoading(true);
    setMfaError(null);
    try {
      const signedIn = await completeMfaLogin(mfa.token, useRecovery ? { recoveryCode: mfaCode.trim() } : { code: mfaCode });
      toast.success('Welcome back!');
      navigate(homePath(signedIn?.user));
    } catch (err) {
      const message = codeError(err);
      setMfaCode('');
      if (err.response?.status === 401 && err.response?.data?.detail === 'Sign in again') {
        setMfa(null);  // the challenge expired or was used: start again from the password
        toast.error(message);
      } else setMfaError(message);
    } finally {
      setLoading(false);
    }
  };

  const restart = () => { setMfa(null); setMfaCode(''); setMfaError(null); setUseRecovery(false); };

  // Field colours live in CSS variables so the autofill override below can
  // repaint Chrome's blue autofill background with the same surface colour.
  const fieldClass = cn(
    'peer w-full h-12 rounded-xl border pl-11 pr-4 text-[0.95rem] outline-none transition-[border-color,box-shadow,background-color] duration-200',
    'bg-[var(--l-field)] border-[var(--l-field-line)] text-[var(--l-ink)] caret-[#FE7725] placeholder:text-[var(--l-muted)]',
    'hover:border-[rgba(254,119,37,0.45)] focus:border-[#FE7725] focus:ring-4 focus:ring-[rgba(254,119,37,0.16)] focus-visible:outline-none',
    'autofill:shadow-[inset_0_0_0_1000px_var(--l-field)] autofill:[-webkit-text-fill-color:var(--l-ink)]',
  );
  const fieldIconClass = 'pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--l-muted)] transition-colors peer-focus:text-[#FE7725]';
  const primaryButton = cn(
    'group flex h-12 w-full items-center justify-center gap-2 rounded-full text-[0.95rem] font-semibold text-[#0B1220]',
    'bg-[#FE7725] shadow-[0_14px_28px_-16px_rgba(254,119,37,0.9)]',
    'transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-px hover:bg-[#FF8A45] hover:shadow-[0_18px_34px_-16px_rgba(254,119,37,1)] active:translate-y-0',
    'disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:brightness-100',
  );
  const linkButton = 'rounded-md font-semibold text-[var(--l-link)] underline-offset-4 transition-colors hover:underline';

  return (
    <MotionConfig reducedMotion="user">
    <div className="nv-login relative isolate flex min-h-screen flex-col overflow-hidden">

      {/* ── Backdrop: orange light behind the orb, a faint grid (dark), the dotted sound wave along the bottom.
             Purely decorative and always behind the content; the 3D wave is skipped on small screens. ── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(38% 46% at 40% 48%, var(--l-glow), transparent 70%)' }} />
        <div className="absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full" style={{ background: 'radial-gradient(circle, rgba(254,119,37,0.2), transparent 62%)' }} />
        <div className="nvl-grid absolute inset-0" />
        <HeroWave3D className="absolute inset-x-0 bottom-0 hidden h-[34%] opacity-70 md:block" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(to_top,var(--l-bg),transparent)] opacity-60" />
      </div>

      {/* ── Top bar ── */}
      <header className="relative z-10 mx-auto flex w-full max-w-[90rem] items-center justify-end gap-4 px-5 pt-5 sm:px-8 sm:pt-7 lg:px-12">
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <Link to="/" aria-label="Back to home" className="group flex items-center gap-2 rounded-md px-1 py-1.5 text-sm font-medium text-[var(--l-muted)] transition-colors hover:text-[var(--l-ink)]">
            <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" aria-hidden="true" />
<span className="hidden sm:inline">Back to home</span>
          </Link>
          <ThemeToggle className="h-10 w-10 border-[var(--l-field-line)] text-[var(--l-muted)] hover:text-[var(--l-link)]" />
        </div>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-[90rem] flex-1 content-center items-center gap-8 px-5 pb-12 pt-8 sm:px-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-4 lg:px-12 lg:pb-16 lg:pt-4">

        {/* ── Brand: compact above the form on small screens; copy, features and the orb on desktop ── */}
        <section aria-label="NVIP" className="mx-auto w-full max-w-[28rem] lg:mx-0 lg:grid lg:max-w-none lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:items-center lg:gap-2">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE_OUT }}>
            {/* Same product name as the public hero: orange bar, "Netsmartz" over "Voice Intelligence Platform",
                initials in orange so they spell NVIP. */}
            <div className="flex items-stretch gap-4">
              <span aria-hidden="true" className="w-1 shrink-0 rounded-full bg-gradient-to-b from-[#FE7725] to-[#FE7725]/0" />
              <p className="nvp-fullname">
                <span className="block">
                  <span className="nvp-initial">N</span>etsmartz
                </span>
                <span className="block">
                  <span className="nvp-initial">V</span>oice <span className="nvp-initial">I</span>ntelligence{' '}
                  <span className="nvp-initial">P</span>latform
                </span>
                <span className="sr-only"> (NVIP)</span>
              </p>
            </div>
            {/* Headline set like the public hero H1: medium weight, so the product name leads. */}
            <p className="mt-10 max-w-[17ch] text-[1.9rem] font-medium leading-[1.14] tracking-[-0.03em] sm:mt-12 sm:text-[2.25rem] lg:text-[2.5rem]">
              Your voice agents, <span className="text-[var(--l-orange-text)]">one workspace.</span>
            </p>
            <p className="mt-4 hidden max-w-[29rem] text-[1.02rem] leading-relaxed text-[var(--l-muted)] sm:block">
              Run calling campaigns, review every conversation and book meetings with the AI voice agents your
              organisation uses.
            </p>

            <ul className="mt-10 hidden max-w-[29rem] divide-y divide-[var(--l-field-line)] border-y border-[var(--l-field-line)] lg:block">
              {FEATURES.map((f, i) => (
                <motion.li key={f.t} className="flex items-start gap-3.5 py-4"
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.25 + i * 0.1, ease: EASE_OUT }}>
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--l-tile)] text-[var(--l-orange-text)]">
                    <f.icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-[0.95rem] font-semibold tracking-[-0.01em]">{f.t}</span>
                    <span className="mt-0.5 block text-[0.88rem] leading-relaxed text-[var(--l-muted)]">{f.d}</span>
                  </span>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* The orb: desktop only, so it never competes with the form on small screens. */}
          <motion.div
            aria-hidden="true"
            className="relative mx-auto hidden aspect-[11/10] w-full max-w-[520px] lg:block"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.1, delay: 0.1, ease: EASE_OUT }}
          >
            <OrbStage shadow="rgba(0,0,0,0.35)" />
          </motion.div>
        </section>

        {/* ── Sign-in card ── */}
        <section className="flex justify-center lg:justify-end">
          <motion.div
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.12, ease: EASE_OUT }}
            className="relative w-full max-w-[27rem] rounded-[1.25rem] border border-[var(--l-card-line)] bg-[var(--l-card)] p-7 shadow-[var(--l-card-shadow)] backdrop-blur-xl sm:p-10"
          >
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit]"
              style={{ background: 'radial-gradient(120% 55% at 0% 0%, rgba(254,119,37,0.12), transparent 60%)' }} />
            <div className="relative">
            {mfa ? (
              <form onSubmit={handleMfa} className="space-y-5" data-testid="login-mfa-form">
                <div>
                  <h1 className="text-[1.65rem] font-semibold leading-tight tracking-[-0.03em]">Two-factor check</h1>
                  <p className="mt-1.5 text-[0.95rem] text-[var(--l-muted)]">
                    {useRecovery ? 'Enter one of your recovery codes. Each works once.'
                      : 'Enter the 6-digit code from your authenticator app.'}
                  </p>
                </div>
                {useRecovery ? (
                  <input id="login-recovery-code" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)}
                    autoComplete="off" autoFocus placeholder="abcde-12345" aria-label="Recovery code" maxLength={20}
                    className={cn(fieldClass, 'pl-4 font-mono tracking-wider')} />
                ) : (
                  <CodeInput id="login-mfa-code" value={mfaCode} onChange={setMfaCode} disabled={loading} />
                )}
                {mfaError && <p role="alert" className="text-sm text-red-500">{mfaError}</p>}
                <button type="submit" disabled={loading || (useRecovery ? !mfaCode.trim() : mfaCode.length !== 6)}
                  className={primaryButton} data-testid="login-mfa-submit">
                  {loading ? 'Checking…' : 'Verify'}
                </button>
                <div className="flex items-center justify-between text-sm">
                  <button type="button" onClick={() => { setUseRecovery((v) => !v); setMfaCode(''); setMfaError(null); }}
                    className={linkButton}>
                    {useRecovery ? 'Use my authenticator app' : 'Use a recovery code'}
                  </button>
                  <button type="button" onClick={restart} className="text-[var(--l-muted)] hover:text-[var(--l-ink)]">Start over</button>
                </div>
              </form>
            ) : (<>
            <h1 className="text-[1.65rem] font-semibold leading-tight tracking-[-0.03em] sm:text-[1.8rem]">Welcome back</h1>
            <p className="mt-1.5 text-[0.95rem] text-[var(--l-muted)]">Sign in to your NVIP workspace.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div className="space-y-2">
                <label htmlFor="login-email" className="block text-[0.85rem] font-medium">Email address</label>
                <div className="relative">
                  <input id="login-email" type="email" autoComplete="email" placeholder="Enter your email" value={email}
                    onChange={e => setEmail(e.target.value)}
                    className={fieldClass} data-testid="login-email-input" required />
                  <Mail className={fieldIconClass} aria-hidden="true" />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="login-password" className="block text-[0.85rem] font-medium">Password</label>
                <div className="relative">
                  <input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                    placeholder="Enter your password" value={password}
                    onChange={e => setPassword(e.target.value)}
                    className={cn(fieldClass, 'pr-12', 'no-native-reveal')} data-testid="login-password-input" required />
                  <LockKeyhole className={fieldIconClass} aria-hidden="true" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}
                    className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--l-muted)] transition-colors hover:text-[var(--l-ink)]">
                    {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 text-sm">
                <label className="flex cursor-pointer select-none items-center gap-2.5 text-[var(--l-muted)] transition-colors hover:text-[var(--l-ink)]">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded accent-[#FE7725]" data-testid="login-remember-checkbox" />
                  Remember me
                </label>
                <button type="button" onClick={() => setShowResetHelp((v) => !v)} aria-expanded={showResetHelp}
                  aria-controls="login-reset-help" className={linkButton}>
                  Forgot password?
                </button>
              </div>

              {showResetHelp && (
                <p id="login-reset-help" role="status"
                  className="flex gap-2.5 rounded-xl border border-[rgba(254,119,37,0.3)] bg-[var(--l-tile)] px-3.5 py-3 text-[0.85rem] leading-relaxed">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--l-orange-text)]" aria-hidden="true" />
                  Passwords are managed by your workspace admin. Ask them for a new temporary password — you'll choose your own the next time you sign in.
                </p>
              )}

              <button type="submit" disabled={loading} className={cn(primaryButton, 'mt-2')} data-testid="login-submit-btn">
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="h-[18px] w-[18px] transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
                  </>
                )}
              </button>
            </form>
            <p className="mt-7 border-t border-[var(--l-field-line)] pt-6 text-center text-sm text-[var(--l-muted)]">
              New to NVIP?{' '}
              <Link to="/request-demo" className="font-semibold text-[var(--l-link)] underline-offset-4 transition-colors hover:underline">
                Book a demo
              </Link>
            </p>
            </>)}
            </div>
          </motion.div>
        </section>
      </main>
    </div>
    </MotionConfig>
  );
}
