// The public landing page: category filter (tabs pattern) over the real agent list, and the labelled sample call.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AgentCatalog from './AgentCatalog';
import { AGENTS } from '../../config/agents';

function renderPage() {
  return render(<MemoryRouter><AgentCatalog /></MemoryRouter>);
}

const panelHeadings = () => within(screen.getByRole('tabpanel')).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);

test('every catalog agent has one card heading, linking to its brochure', async () => {
  renderPage();
  for (const agent of AGENTS) {
    const heading = await screen.findByRole('heading', { name: agent.name });
    expect(heading.closest('a')).toHaveAttribute('href', `/marketplace/${agent.slug}`);
  }
});

test('a category tab shows only that category, and arrow keys move between tabs', async () => {
  renderPage();
  const sales = await screen.findByRole('tab', { name: /sales/i });
  fireEvent.click(sales);
  expect(sales).toHaveAttribute('aria-selected', 'true');
  const salesNames = AGENTS.filter((a) => a.category === 'sales').map((a) => a.name);
  // Cards that leave play a short exit animation first.
  await waitFor(() => expect(panelHeadings()).toEqual([...salesNames, 'Need something custom?']));

  fireEvent.keyDown(sales, { key: 'ArrowRight' });
  const recruitment = screen.getByRole('tab', { name: /recruitment/i });
  expect(recruitment).toHaveAttribute('aria-selected', 'true');
  expect(recruitment).toHaveFocus();
  expect(sales).toHaveAttribute('tabindex', '-1');
});

test('the call example is labelled as a sample and shows the agent’s real capture fields', async () => {
  renderPage();
  const transcript = await screen.findByRole('list', { name: 'Sample call transcript' });
  // No IntersectionObserver in jsdom: the whole call is shown at once.
  await waitFor(() => expect(within(transcript).getAllByRole('listitem').length).toBeGreaterThan(5));
  expect(screen.getByText('Sample call')).toBeInTheDocument();
  const sdr = AGENTS.find((a) => a.type === 'sdr');
  sdr.captures.forEach((label) => expect(screen.getAllByText(label).length).toBeGreaterThan(0));
});
