import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockUseQuery = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQuery: (opts: unknown) => mockUseQuery(opts),
}));
jest.mock('@/components/layout/PageLayout', () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('@/components/admin/AdminNav', () => ({ AdminNav: () => <nav /> }));

const toastSuccess = jest.fn();
const toastError = jest.fn();
jest.mock('sonner', () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

import { AdminMessages } from '../AdminMessages';

function mockRecipients(count: number) {
  mockUseQuery.mockReturnValue({ data: { count, paidOnly: false }, isLoading: false, isError: false });
}

const fetchMock = jest.fn();

beforeEach(() => {
  mockUseQuery.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  fetchMock.mockReset().mockResolvedValue({
    ok: true,
    json: async () => ({ sent: 2, failed: 0, skipped: 0, test: false }),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('AdminMessages', () => {
  it('renders the typed HTML into the sandboxed preview iframe', async () => {
    mockRecipients(5);
    render(<AdminMessages />);
    const body = screen.getByLabelText(/message body/i);
    await userEvent.type(body, '<h1>Hello</h1>');
    const iframe = screen.getByTitle('Email preview') as HTMLIFrameElement;
    expect(iframe.getAttribute('srcDoc')).toContain('<h1>Hello</h1>');
    expect(iframe.getAttribute('sandbox')).toBe('');
  });

  it('refetches the count with paidOnly=true when switching scope', async () => {
    mockRecipients(5);
    render(<AdminMessages />);
    await userEvent.click(screen.getByRole('button', { name: /paid users only/i }));
    const lastCall = mockUseQuery.mock.calls.at(-1)?.[0] as { queryKey: unknown[] };
    expect(lastCall.queryKey).toEqual(['admin-message-recipients', true]);
  });

  it('shows a confirm dialog before a real broadcast, then sends with test:false', async () => {
    mockRecipients(3);
    render(<AdminMessages />);
    await userEvent.type(screen.getByLabelText(/subject/i), 'Kickoff');
    await userEvent.type(screen.getByLabelText(/message body/i), '<p>hi</p>');

    await userEvent.click(screen.getByRole('button', { name: /send to 3 recipients/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/send broadcast\?/i)).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: /send now/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      subject: 'Kickoff',
      test: false,
    });
  });

  it('sends a test to the admin (test:true) without a confirm dialog', async () => {
    mockRecipients(3);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ sent: 1, failed: 0, skipped: 0, test: true }),
    });
    render(<AdminMessages />);
    await userEvent.type(screen.getByLabelText(/subject/i), 'Kickoff');
    await userEvent.type(screen.getByLabelText(/message body/i), '<p>hi</p>');

    await userEvent.click(screen.getByRole('button', { name: /send test to me/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ test: true });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
