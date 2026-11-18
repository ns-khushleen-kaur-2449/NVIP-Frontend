// F-02: a Super Admin switch change reaches a signed-in user without signing out.
//   CI=true npx craco test --watchAll=false src/lib/authRefresh.test.jsx src/lib/featureLoss.test.js
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { getMe } from '@/lib/api';
import { AuthProvider, FOCUS_REFRESH_MIN_MS, SESSION_REFRESH_MS, useAuth } from '@/lib/AuthContext';
import FeatureLossWatcher from '@/components/auth/FeatureLossWatcher';

jest.mock('@/lib/api', () => ({
  getMe: jest.fn(), authLogin: jest.fn(), authLoginMfa: jest.fn(), authLogout: jest.fn(() => Promise.resolve()),
  authRegister: jest.fn(), changePassword: jest.fn(), verifyMfaEnrollment: jest.fn(),
}));
jest.mock('sonner', () => ({ toast: { info: jest.fn(), success: jest.fn(), error: jest.fn() } }));

const me = (features) => ({ data: { id: 7, role: 'manager', tenant_id: 't-1', permissions: [], features } });
const ON = { agent_instances: true, voice_agent: true, campaigns: true };
const OFF = { agent_instances: false, voice_agent: true, campaigns: true };

const renders = [];
function Probe() {
  const { user } = useAuth();
  const location = useLocation();
  renders.push(user);
  return (
    <>
      <p data-testid="where">{location.pathname}{location.search}</p>
      <p data-testid="instances">{String(user?.features?.agent_instances)}</p>
    </>
  );
}

function mount(path = '/agents/sdr_outbound') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <FeatureLossWatcher />
        <Routes><Route path="*" element={<Probe />} /></Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const advance = (ms) => act(async () => { jest.advanceTimersByTime(ms); await Promise.resolve(); await Promise.resolve(); });
const focus = () => act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  jest.useFakeTimers('modern');
  localStorage.clear();
  localStorage.setItem('estateops_token', 'tok');
  getMe.mockReset();
  toast.info.mockClear();
  renders.length = 0;
});
afterEach(() => jest.useRealTimers());

describe('the session re-reads /api/auth/me', () => {
  test('on window focus: features update in place, no reload, no sign-out', async () => {
    getMe.mockResolvedValueOnce(me(ON)).mockResolvedValue(me(OFF));
    mount('/dashboard');
    await flush();
    expect(screen.getByTestId('instances')).toHaveTextContent('true');
    await advance(FOCUS_REFRESH_MIN_MS);
    await focus();
    expect(getMe).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('instances')).toHaveTextContent('false');
    expect(localStorage.getItem('estateops_token')).toBe('tok');
  });

  test('a focus right after the last read does not ask again', async () => {
    getMe.mockResolvedValue(me(ON));
    mount('/dashboard');
    await flush();
    await focus();
    expect(getMe).toHaveBeenCalledTimes(1);
  });

  test('every 5 minutes while signed in', async () => {
    getMe.mockResolvedValueOnce(me(ON)).mockResolvedValue(me(OFF));
    mount('/dashboard');
    await flush();
    await advance(SESSION_REFRESH_MS - 1000);
    expect(getMe).toHaveBeenCalledTimes(1);
    await advance(1000);
    expect(getMe).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('instances')).toHaveTextContent('false');
  });

  test('not while signed out', async () => {
    localStorage.clear();
    mount('/dashboard');
    await advance(SESSION_REFRESH_MS * 2);
    await focus();
    expect(getMe).not.toHaveBeenCalled();
  });

  test('an unchanged answer keeps the same user object', async () => {
    getMe.mockResolvedValue(me(ON));
    mount('/dashboard');
    await flush();
    const first = renders[renders.length - 1];
    await advance(SESSION_REFRESH_MS);
    expect(getMe).toHaveBeenCalledTimes(2);
    expect(renders[renders.length - 1]).toBe(first);
  });

  test('a failed read keeps the current user', async () => {
    getMe.mockResolvedValueOnce(me(ON)).mockRejectedValue({ response: { status: 503 } });
    mount('/dashboard');
    await flush();
    await advance(SESSION_REFRESH_MS);
    expect(screen.getByTestId('instances')).toHaveTextContent('true');
  });
});

describe('an open page that is no longer allowed', () => {
  test('agent_instances switched off on agent setup: dashboard with a notice', async () => {
    getMe.mockResolvedValueOnce(me(ON)).mockResolvedValue(me(OFF));
    mount('/agents/sdr_outbound');
    await flush();
    expect(screen.getByTestId('where')).toHaveTextContent('/agents/sdr_outbound');
    await advance(SESSION_REFRESH_MS);
    expect(screen.getByTestId('where')).toHaveTextContent('/dashboard');
    expect(toast.info).toHaveBeenCalledWith('Agent configuration was switched off for your organisation.');
  });

  test.each([
    ['/call-logs?assistant=a1', '/voice_agent?assistant=a1&tab=logs'],
    ['/single-call', '/voice_agent?tab=single'],
    ['/prospects?prospect=p-9', '/prospecting?prospect=p-9'],
  ])('agent_instances switched off on %s: the legacy page %s, with the notice', async (from, to) => {
    getMe.mockResolvedValueOnce(me(ON)).mockResolvedValue(me(OFF));
    mount(from);
    await flush();
    expect(screen.getByTestId('where')).toHaveTextContent(from);
    await advance(SESSION_REFRESH_MS);
    expect(screen.getByTestId('where')).toHaveTextContent(to);
    expect(toast.info).toHaveBeenCalledWith('Agent configuration was switched off for your organisation.');
  });

  test('campaigns switched off on a campaign page', async () => {
    getMe.mockResolvedValueOnce(me(ON)).mockResolvedValue(me({ ...ON, campaigns: false }));
    mount('/voice-campaigns/c-1?tab=x');
    await flush();
    await advance(SESSION_REFRESH_MS);
    expect(screen.getByTestId('where')).toHaveTextContent('/dashboard');
    expect(screen.getByTestId('where').textContent).toBe('/dashboard'); // no query carried to the dashboard
    expect(toast.info).toHaveBeenCalledWith('Campaigns was switched off for your organisation.');
  });

  test('a page that does not need the switch stays put', async () => {
    getMe.mockResolvedValueOnce(me(ON)).mockResolvedValue(me(OFF));
    mount('/agents');
    await flush();
    await advance(SESSION_REFRESH_MS);
    expect(screen.getByTestId('where')).toHaveTextContent('/agents');
    expect(toast.info).not.toHaveBeenCalled();
  });

  test('first load with the switch already off: the page guard decides, no notice', async () => {
    getMe.mockResolvedValue(me(OFF));
    mount('/agents/sdr_outbound');
    await flush();
    expect(screen.getByTestId('where')).toHaveTextContent('/agents/sdr_outbound');
    expect(toast.info).not.toHaveBeenCalled();
  });
});
