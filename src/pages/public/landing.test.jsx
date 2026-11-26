// The NVIP landing page (home for guests) and its header: the agents' status comes from config/agents.js.
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PublicLayout from '@/layouts/PublicLayout';
import AgentCatalog from '@/pages/public/AgentCatalog';

jest.mock('@/components/ThemeToggle', () => function ThemeToggleStub() { return null; });

const page = () => render(
  <MemoryRouter initialEntries={['/']}>
    <Routes><Route element={<PublicLayout />}><Route path="/" element={<AgentCatalog />} /></Route></Routes>
  </MemoryRouter>,
);

test('hero: the Netsmartz logo, the headline and both calls to action', () => {
  page();
  expect(screen.getByRole('link', { name: 'NVIP by Netsmartz, home' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Meet the AI voice agents that move your business forward.');
  expect(screen.getAllByRole('link', { name: 'Book a demo' })[0]).toHaveAttribute('href', '/request-demo');
  expect(screen.getByRole('link', { name: 'Explore AI agents' })).toHaveAttribute('href', '/#agents');
});

test('four agents: Outbound, Hiring and Real Estate are Available, Inbound SDR Coming soon, no Receptionist', async () => {
  page();
  const status = async (name) => {
    const card = (await screen.findByRole('heading', { name })).closest('a');
    return within(card).getByText(/^(Available|Coming soon)$/).textContent;
  };
  const available = await Promise.all(['Outbound Lead Gen', 'Hiring / Recruitment', 'Real Estate Agent'].map(status));
  expect(available).toEqual(['Available', 'Available', 'Available']);
  expect(await status('Inbound Voice SDR')).toBe('Coming soon');
  expect(screen.queryByRole('heading', { name: 'AI Receptionist' })).not.toBeInTheDocument();
  expect((await screen.findByRole('heading', { name: 'Outbound Lead Gen' })).closest('a')).toHaveAttribute('href', '/marketplace/outbound-lead-gen');
});

test('header links, sign in, and the sections they point to exist', () => {
  page();
  const nav = screen.getAllByRole('navigation', { name: 'Main' })[0];
  expect(within(nav).getByRole('link', { name: 'Agents' })).toHaveAttribute('href', '/');
  expect(within(nav).getByRole('link', { name: 'Integrations' })).toHaveAttribute('href', '/#integrations');
  expect(screen.getAllByRole('link', { name: 'Sign in' })[0]).toHaveAttribute('href', '/login');
  ['agents', 'integrations'].forEach((id) => expect(document.getElementById(id)).not.toBeNull());
});
