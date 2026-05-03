import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '../LoginForm';

const signInMock = jest.fn();

jest.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signInWithPassword: signInMock },
  }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe('LoginForm', () => {
  beforeEach(() => signInMock.mockReset());

  it('submits credentials to supabase', async () => {
    signInMock.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<LoginForm redirectTo="/predictions" />);

    await user.type(screen.getByLabelText(/Email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/Password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /Sign in/i }));

    expect(signInMock).toHaveBeenCalledWith({
      email: 'alice@example.com',
      password: 'password123',
    });
  });

  it('surfaces supabase errors', async () => {
    signInMock.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    const user = userEvent.setup();
    render(<LoginForm redirectTo="/predictions" />);

    await user.type(screen.getByLabelText(/Email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/Password/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /Sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Invalid login credentials/);
  });
});
