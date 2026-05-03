import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterForm } from '../RegisterForm';

const signUpMock = jest.fn();

jest.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signUp: signUpMock },
  }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe('RegisterForm', () => {
  beforeEach(() => {
    signUpMock.mockReset();
  });

  it('rejects a username that does not match the format', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/^Username/i), 'ab');
    await user.type(screen.getByLabelText(/^Email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/^Password/i), 'password123');
    await user.type(screen.getByLabelText(/Confirm password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /Create account/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/3–24 characters/);
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it('rejects a short password', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/^Username/i), 'alice');
    await user.type(screen.getByLabelText(/^Email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/^Password/i), 'short');
    await user.type(screen.getByLabelText(/Confirm password/i), 'short');
    await user.click(screen.getByRole('button', { name: /Create account/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/at least 8 characters/);
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/^Username/i), 'alice');
    await user.type(screen.getByLabelText(/^Email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/^Password/i), 'password123');
    await user.type(screen.getByLabelText(/Confirm password/i), 'password456');
    await user.click(screen.getByRole('button', { name: /Create account/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/do not match/);
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it('submits valid input to supabase', async () => {
    signUpMock.mockResolvedValue({ data: { session: null }, error: null });
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/^Username/i), 'alice');
    await user.type(screen.getByLabelText(/^Email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/^Password/i), 'password123');
    await user.type(screen.getByLabelText(/Confirm password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /Create account/i }));

    expect(signUpMock).toHaveBeenCalledWith({
      email: 'alice@example.com',
      password: 'password123',
      options: { data: { username: 'alice' } },
    });
  });

  it('surfaces a friendlier message when username is taken', async () => {
    signUpMock.mockResolvedValue({
      data: { session: null },
      error: { message: 'duplicate key value violates unique constraint "profiles_username_key"' },
    });
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/^Username/i), 'alice');
    await user.type(screen.getByLabelText(/^Email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/^Password/i), 'password123');
    await user.type(screen.getByLabelText(/Confirm password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /Create account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/already taken/);
  });
});
