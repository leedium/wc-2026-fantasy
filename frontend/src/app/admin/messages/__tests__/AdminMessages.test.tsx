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

type QueryUser = { id: string; username: string; email: string };

// The component runs two useQuery calls (recipient count + user search); return
// the right shape per queryKey.
function mockRecipients(count: number, users: QueryUser[] = []) {
  mockUseQuery.mockImplementation((opts: { queryKey: unknown[] }) => {
    if (opts.queryKey[0] === 'admin-message-users') {
      return { data: { users }, isLoading: false, isError: false };
    }
    return { data: { count, segment: 'all' }, isLoading: false, isError: false };
  });
}

function lastRecipientsQueryKey(): unknown[] {
  const calls = mockUseQuery.mock.calls.filter(
    (c) => (c[0] as { queryKey: unknown[] }).queryKey[0] === 'admin-message-recipients'
  );
  return (calls.at(-1)?.[0] as { queryKey: unknown[] }).queryKey;
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

  it('refetches the count with the chosen segment when switching the radio', async () => {
    mockRecipients(5);
    render(<AdminMessages />);
    await userEvent.click(screen.getByRole('radio', { name: 'Prediction, unpaid' }));
    expect(lastRecipientsQueryKey()).toEqual(['admin-message-recipients', 'unpaid']);
  });

  it('picks a specific user and sends to just that email', async () => {
    mockRecipients(0, [{ id: 'u9', username: 'charlie', email: 'charlie@x.com' }]);
    render(<AdminMessages />);
    await userEvent.type(screen.getByLabelText(/subject/i), 'Hi');
    await userEvent.type(screen.getByLabelText(/message body/i), '<p>hi</p>');

    await userEvent.click(screen.getByRole('radio', { name: 'Specific user' }));
    // pick the user from the results list
    await userEvent.click(screen.getByRole('button', { name: /charlie/i }));

    await userEvent.click(screen.getByRole('button', { name: /send to 1 recipient/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/charlie@x\.com/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: /send now/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const sendCall = fetchMock.mock.calls.find((c) => c[0] === '/api/admin/messages/send');
    expect(JSON.parse((sendCall![1] as RequestInit).body as string)).toMatchObject({
      segment: 'user',
      email: 'charlie@x.com',
      test: false,
    });
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
