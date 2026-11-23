// Users page: Invite (a link, no email) is the default; "Add user (temporary password)" stays beside it.
import { screen } from '@testing-library/react';
import UsersPage from '@/pages/admin/Users';
import * as api from '@/lib/api';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';

jest.mock('@/lib/api', () => ({
  listAdminUsers: jest.fn(), listTenants: jest.fn(), deactivateUser: jest.fn(), reactivateUser: jest.fn(),
  listInvitations: jest.fn(), createInvitation: jest.fn(), resendInvitation: jest.fn(), revokeInvitation: jest.fn(),
  createTenantInvitation: jest.fn(), listTenantInvitations: jest.fn(), resendTenantInvitation: jest.fn(),
  revokeTenantInvitation: jest.fn(), register: jest.fn(), listManagers: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  api.listAdminUsers.mockResolvedValue({ data: { users: [], total: 0 } });
  api.listTenants.mockResolvedValue({ data: { tenants: [] } });
  api.listInvitations.mockResolvedValue({ data: [] });
});

test('a Tenant Admin gets Invite as the main button, and the invites list', async () => {
  renderWithAuth(<UsersPage />, { user: USERS.tenant_admin });
  expect(await screen.findByRole('button', { name: 'Invite' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add user (temporary password)' })).toBeInTheDocument();
  expect(await screen.findByTestId('invitations-list')).toBeInTheDocument();
});

test('a Super Admin keeps Add user here (a tenant admin is invited from Tenants)', async () => {
  renderWithAuth(<UsersPage />, { user: USERS.super_admin });
  expect(await screen.findByRole('button', { name: 'Add user' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Invite' })).not.toBeInTheDocument();
  expect(api.listInvitations).not.toHaveBeenCalled();
});
