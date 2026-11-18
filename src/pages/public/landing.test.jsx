// The NVIP landing page (home for guests) and its header: the agents' status comes from config/agents.js.
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PublicLayout from '@/layouts/PublicLayout';
import AgentCatalog from '@/pages/public/AgentCatalog';

jest.mock('@/components/ThemeToggle', () => function ThemeToggleStub() { return null; });
jest.mock('@/components/marketing/HeroWave3D', () => function WaveStub() { return <div data-testid="wave" />; });

const page = () => render(
  <MemoryRouter initialEntries={['/']}>
    <Routes><Route element={<PublicLayout />}><Route path="/" element={<AgentCatalog />} /></Route></Routes>
  </MemoryRouter>,
);

test('hero and calls to action, on the sign-in page\'s background', () => {
  page();
  expect(screen.getByTestId('wave')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Voice agents that call, qualify and book — on rules you control');
  expect(screen.getAllByRole('link', { name: 'Book a demo' })[0]).toHaveAttribute('href', '/request-demo');
  expect(screen.getByRole('link', { name: 'Talk to sales' })).toHaveAttribute('href', '/request-quote');
});

test('five agents: the three with a backend are Available, the rest Coming soon', () => {
  page();
  const status = (name) => within(screen.getByRole('heading', { name }).closest('a')).getByText(/Available|Coming soon/).textContent;
  expect(['Outbound SDR', 'Inbound SDR', 'Hiresmartz'].map(status)).toEqual(['Available', 'Available', 'Available']);
  expect(['AI Receptionist', 'Real Estate Agent'].map(status)).toEqual(['Coming soon', 'Coming soon']);
  expect(screen.getByRole('heading', { name: 'Outbound SDR' }).closest('a')).toHaveAttribute('href', '/marketplace/outbound-lead-gen');
});

test('header sections, sign in, sections exist', () => {
  page();
  const nav = screen.getAllByRole('navigation', { name: 'Main' })[0];
  expect(within(nav).getByRole('link', { name: 'Agents' })).toHaveAttribute('href', '/#agents');
  expect(within(nav).getByRole('link', { name: 'Trust & security' })).toHaveAttribute('href', '/#trust');
  expect(screen.getAllByRole('link', { name: 'Sign in' })[0]).toHaveAttribute('href', '/login');
  ['agents', 'how-it-works', 'trust'].forEach((id) => expect(document.getElementById(id)).not.toBeNull());
  expect(screen.getByText('Every call follows your rules')).toBeInTheDocument();
  expect(screen.getByText('NVIP is built by Netsmartz · since 1999')).toBeInTheDocument();
});
