import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResetPasswordForm } from '../ResetPasswordForm';
import { mockPush, mockRefresh } from '../../../../jest.setup';

const toastSuccessMock = jest.fn();
jest.mock('sonner', () => ({
  toast: { success: (...args: unknown[]) => toastSuccessMock(...args), error: jest.fn() },
}));

describe('ResetPasswordForm', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    toastSuccessMock.mockReset();
    mockPush.mockReset();
    mockRefresh.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('rejects passwords shorter than 8 chars', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.type(screen.getByLabelText(/^New password/i), 'short');
    await user.type(screen.getByLabelText(/Confirm new password/i), 'short');
    await user.click(screen.getByRole('button', { name: /Update password/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 8 characters/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects mismatched confirmation', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.type(screen.getByLabelText(/^New password/i), 'longenough1');
    await user.type(screen.getByLabelText(/Confirm new password/i), 'different1!');
    await user.click(screen.getByRole('button', { name: /Update password/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts password and redirects to predictions on success', async () => {
    fetchMock.mockResolvedValue({ ok: true } as Response);
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.type(screen.getByLabelText(/^New password/i), 'longenough1');
    await user.type(screen.getByLabelText(/Confirm new password/i), 'longenough1');
    await user.click(screen.getByRole('button', { name: /Update password/i }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/reset-password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ password: 'longenough1' }),
      })
    );
    await screen.findByRole('button', { name: /Updating…|Update password/i });
    expect(toastSuccessMock).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/predictions');
  });

  it('surfaces server errors', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'New password should be different' }),
    } as Response);
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.type(screen.getByLabelText(/^New password/i), 'longenough1');
    await user.type(screen.getByLabelText(/Confirm new password/i), 'longenough1');
    await user.click(screen.getByRole('button', { name: /Update password/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/should be different/i);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows generic error on network failure', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.type(screen.getByLabelText(/^New password/i), 'longenough1');
    await user.type(screen.getByLabelText(/Confirm new password/i), 'longenough1');
    await user.click(screen.getByRole('button', { name: /Update password/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/network error/i);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
