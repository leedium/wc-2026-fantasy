import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ForgotPasswordForm } from '../ForgotPasswordForm';

describe('ForgotPasswordForm', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('posts identifier and shows uniform success panel', async () => {
    fetchMock.mockResolvedValue({ ok: true } as Response);
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/Email or username/i), 'alice');
    await user.click(screen.getByRole('button', { name: /Send reset link/i }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/forgot-password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ identifier: 'alice' }),
      })
    );
    expect(await screen.findByRole('status')).toHaveTextContent(/we've sent a reset link/i);
    expect(screen.queryByLabelText(/Email or username/i)).not.toBeInTheDocument();
  });

  it('shows error alert on transport failure', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/Email or username/i), 'alice@example.com');
    await user.click(screen.getByRole('button', { name: /Send reset link/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/network error/i);
  });

  it('shows error alert when API returns non-2xx', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/Email or username/i), 'alice');
    await user.click(screen.getByRole('button', { name: /Send reset link/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong/i);
  });
});
