import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { RegisterForm } from '../RegisterForm';

const signUpMock = jest.fn();
const resendMock = jest.fn();

jest.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signUp: signUpMock, resend: resendMock },
  }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const toastSuccess = toast.success as jest.Mock;
const toastError = toast.error as jest.Mock;

describe('RegisterForm', () => {
  beforeEach(() => {
    signUpMock.mockReset();
    resendMock.mockReset();
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  it('rejects an invalid email', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/^Email/i), 'not-an-email');
    await user.type(screen.getByLabelText(/^Password/i), 'password123');
    await user.type(screen.getByLabelText(/Confirm password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /Create account/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/valid email/);
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it('rejects a short password', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

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

    await user.type(screen.getByLabelText(/^Email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/^Password/i), 'password123');
    await user.type(screen.getByLabelText(/Confirm password/i), 'password456');
    await user.click(screen.getByRole('button', { name: /Create account/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/do not match/);
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it('submits without a username field — server auto-generates one', async () => {
    signUpMock.mockResolvedValue({ data: { session: null }, error: null });
    const user = userEvent.setup();
    render(<RegisterForm />);

    expect(screen.queryByLabelText(/^Username/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/^Email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/^Password/i), 'password123');
    await user.type(screen.getByLabelText(/Confirm password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /Create account/i }));

    expect(signUpMock).toHaveBeenCalledWith({
      email: 'alice@example.com',
      password: 'password123',
    });
  });

  it('surfaces a friendly error when the email is already registered', async () => {
    signUpMock.mockResolvedValue({
      data: { session: null },
      error: { message: 'User already registered' },
    });
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/^Email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/^Password/i), 'password123');
    await user.type(screen.getByLabelText(/Confirm password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /Create account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/already exists/);
  });

  it('replaces the form with a persistent "Check your email" view naming the user address', async () => {
    signUpMock.mockResolvedValue({ data: { session: null }, error: null });
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/^Email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/^Password/i), 'password123');
    await user.type(screen.getByLabelText(/Confirm password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /Create account/i }));

    expect(await screen.findByText(/Check your email/i)).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    // Form inputs are gone — the swap happened, not just a toast.
    expect(screen.queryByLabelText(/^Email/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Password/i)).not.toBeInTheDocument();
    // Resend + sign-in affordances are present.
    expect(
      screen.getByRole('button', { name: /Resend confirmation email/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Go to sign in/i })).toHaveAttribute(
      'href',
      '/login'
    );
    expect(toastSuccess).toHaveBeenCalledWith(
      expect.stringMatching(/check your email/i)
    );
  });

  it('reopens the signup form when "Try a different address" is clicked', async () => {
    signUpMock.mockResolvedValue({ data: { session: null }, error: null });
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/^Email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/^Password/i), 'password123');
    await user.type(screen.getByLabelText(/Confirm password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /Create account/i }));

    await user.click(screen.getByRole('button', { name: /Try a different address/i }));

    const emailInput = await screen.findByLabelText(/^Email/i);
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveValue('');
    expect(screen.queryByText(/Check your email/i)).not.toBeInTheDocument();
  });

  it('resends the confirmation email when Resend is clicked', async () => {
    signUpMock.mockResolvedValue({ data: { session: null }, error: null });
    resendMock.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/^Email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/^Password/i), 'password123');
    await user.type(screen.getByLabelText(/Confirm password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /Create account/i }));

    await user.click(screen.getByRole('button', { name: /Resend confirmation email/i }));

    expect(resendMock).toHaveBeenCalledWith({
      type: 'signup',
      email: 'alice@example.com',
    });
    expect(toastSuccess).toHaveBeenCalledWith(
      expect.stringMatching(/resent/i)
    );
  });
});
