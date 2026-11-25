// Book a demo / request a quote: several agents of interest, and the sign-in page's background.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RequestAccess from '@/pages/public/RequestAccess';
import { accessApi } from '@/api/services';

jest.mock('@/components/marketing/HeroWave3D', () => function WaveStub() { return <div data-testid="wave" />; });
jest.mock('@/api/services', () => ({ accessApi: { submitRequest: jest.fn(() => Promise.resolve({})) } }));

const open = (path = '/request-demo') => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/request-demo" element={<RequestAccess kind="demo" />} /></Routes>
  </MemoryRouter>,
);

const fill = () => {
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Asha Verma' } });
  fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'asha@example.com' } });
  fireEvent.change(screen.getByLabelText('Company'), { target: { value: 'Sample Traders' } });
};

beforeEach(() => accessApi.submitRequest.mockClear());

test('several agents can be picked and are sent together, in catalog order', async () => {
  open();
  expect(screen.getByTestId('wave')).toBeInTheDocument(); // the sign-in page's background
  fill();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Hiring / Recruitment' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Outbound Lead Gen' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Real Estate Agent' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Real Estate Agent' })); // and untick again
  fireEvent.click(screen.getByRole('button', { name: 'Request demo' }));
  await waitFor(() => expect(accessApi.submitRequest).toHaveBeenCalled());
  const [kind, payload] = accessApi.submitRequest.mock.calls[0];
  expect(kind).toBe('demo');
  expect(payload.agents).toEqual(['outbound-lead-gen', 'hiring-recruitment']);
  expect(payload).toMatchObject({ name: 'Asha Verma', email: 'asha@example.com', company: 'Sample Traders' });
});

test('none picked means not sure yet; ?agent= preselects one', async () => {
  open('/request-demo?agent=real-estate');
  expect(screen.getByRole('checkbox', { name: 'Real Estate Agent' })).toBeChecked();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Real Estate Agent' }));
  fill();
  fireEvent.click(screen.getByRole('button', { name: 'Request demo' }));
  await waitFor(() => expect(accessApi.submitRequest).toHaveBeenCalled());
  expect(accessApi.submitRequest.mock.calls[0][1].agents).toEqual([]);
});
