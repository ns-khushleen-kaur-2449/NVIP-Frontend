// Invite links: the public invite page, the invite dialog (a link to copy, no email) and the invites list.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import InviteAcceptPage from '@/pages/InviteAccept';
import { InvitationsList, InviteDialog } from '@/components/admin/Invitations';
import * as api from '@/lib/api';

jest.mock('@/lib/api', () => ({
  getInvitation: jest.fn(), acceptInvitation: jest.fn(), createInvitation: jest.fn(), listInvitations: jest.fn(),
  resendInvitation: jest.fn(), revokeInvitation: jest.fn(), createTenantInvitation: jest.fn(),
  listTenantInvitations: jest.fn(), resendTenantInvitation: jest.fn(), revokeTenantInvitation: jest.fn(),
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const PREVIEW = { tenant_name: 'Aditi Enterprises', role: 'manager', email: 'riya@example.com', name: 'Riya',
  expires_at: '2026-11-30T10:00:00Z' };

const openPage = (token = 'tok-123') => render(
  <MemoryRouter initialEntries={[`/invite/${token}`]}>
    <Routes><Route path="/invite/:token" element={<InviteAcceptPage />} /><Route path="/login" element={<p>Login</p>} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  jest.clearAllMocks();
  document.head.querySelectorAll('meta[name="referrer"]').forEach((m) => m.remove());
});

describe('the invite page', () => {
  test('shows who is invited, sets the password and joins', async () => {
    api.getInvitation.mockResolvedValue({ data: PREVIEW });
    api.acceptInvitation.mockResolvedValue({ data: { email: 'riya@example.com', message: 'Your account is ready.' } });
    openPage();
    expect(await screen.findByText('Join Aditi Enterprises')).toBeInTheDocument();
    expect(screen.getByText(/invited as Manager/)).toBeInTheDocument();
    expect(document.head.querySelector('meta[name="referrer"]').content).toBe('no-referrer');
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Str0ng!Passw0rd' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Different!1' } });
    fireEvent.click(screen.getByRole('button', { name: /Create my account/ }));
    expect(screen.getByRole('alert')).toHaveTextContent("The passwords don't match.");
    expect(api.acceptInvitation).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Str0ng!Passw0rd' } });
    fireEvent.click(screen.getByRole('button', { name: /Create my account/ }));
    await waitFor(() => expect(api.acceptInvitation).toHaveBeenCalledWith('tok-123', 'Str0ng!Passw0rd'));
    expect(await screen.findByText("You're in")).toBeInTheDocument();
  });

  test.each([
    ['invite_expired', 'This invite link has expired. Ask for a new one.'],
    ['invite_used', 'This invite link has already been used. Sign in instead.'],
    ['invite_revoked', 'This invite link was cancelled. Ask for a new one.'],
  ])('a %s link gets its own page', async (code, message) => {
    api.getInvitation.mockRejectedValue({ response: { status: 410, data: { detail: { code, message } } } });
    openPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });

  test('the referrer meta is removed when the page closes', async () => {
    api.getInvitation.mockResolvedValue({ data: PREVIEW });
    const { unmount } = openPage();
    await screen.findByText('Join Aditi Enterprises');
    unmount();
    expect(document.head.querySelector('meta[name="referrer"]')).toBeNull();
  });
});

describe('inviting', () => {
  test('the dialog creates a link to copy (no email)', async () => {
    api.createInvitation.mockResolvedValue({ data: { invitation: { id: 'i-1' }, link: 'https://app.example.com/invite/abc' } });
    const onInvited = jest.fn();
    render(<InviteDialog open onOpenChange={() => {}} roles={['manager', 'rep']} onInvited={onInvited} />);
    const dialog = screen.getByTestId('invite-dialog');
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Riya' } });
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'riya@example.com' } });
    fireEvent.change(within(dialog).getByLabelText('Role'), { target: { value: 'rep' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Create invite link/ }));
    await waitFor(() => expect(api.createInvitation).toHaveBeenCalledWith({ name: 'Riya', email: 'riya@example.com', role: 'rep' }));
    expect(await within(dialog).findByLabelText('Invite link')).toHaveValue('https://app.example.com/invite/abc');
    expect(within(dialog).getByText(/shown\s+only now/)).toBeInTheDocument();
    expect(onInvited).toHaveBeenCalled();
  });

  test("a Super Admin invites a tenant's admin through the tenant route", async () => {
    api.createTenantInvitation.mockResolvedValue({ data: { invitation: { id: 'i-2' }, link: 'https://app.example.com/invite/x' } });
    render(<InviteDialog open onOpenChange={() => {}} roles={['tenant_admin']} tenantId="t-9" />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'First Admin' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Create invite link/ }));
    await waitFor(() => expect(api.createTenantInvitation).toHaveBeenCalledWith('t-9',
      { name: 'First Admin', email: 'admin@example.com', role: 'tenant_admin' }));
  });

  test('a refused invite shows why (e.g. one already pending)', async () => {
    api.createInvitation.mockRejectedValue({ response: { status: 409,
      data: { detail: 'An invite is already pending for this email; resend it.' } } });
    render(<InviteDialog open onOpenChange={() => {}} roles={['rep']} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'R' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'r@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Create invite link/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('An invite is already pending for this email; resend it.');
  });
});

describe('the invites list', () => {
  const ROWS = [
    { id: 'p', name: 'Pending P', email: 'p@x.co', role: 'rep', status: 'pending', expires_at: '2026-11-30T00:00:00Z' },
    { id: 'u', name: 'Used U', email: 'u@x.co', role: 'rep', status: 'used', expires_at: '2026-11-30T00:00:00Z' },
  ];

  test('resend shows the new link; cancel revokes; a joined invite has neither', async () => {
    api.listInvitations.mockResolvedValue({ data: ROWS });
    api.resendInvitation.mockResolvedValue({ data: { invitation: { id: 'p2' }, link: 'https://app.example.com/invite/new' } });
    api.revokeInvitation.mockResolvedValue({ data: { ...ROWS[0], status: 'revoked' } });
    render(<InvitationsList />);
    const pending = await screen.findByTestId('invite-p');
    expect(within(screen.getByTestId('invite-u')).queryByRole('button')).toBeNull();
    fireEvent.click(within(pending).getByRole('button', { name: 'Resend' }));
    await waitFor(() => expect(api.resendInvitation).toHaveBeenCalledWith('p'));
    expect(await screen.findByLabelText('Invite link')).toHaveValue('https://app.example.com/invite/new');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(within(await screen.findByTestId('invite-p')).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(api.revokeInvitation).toHaveBeenCalledWith('p'));
  });
});
