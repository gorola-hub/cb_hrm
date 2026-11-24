import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginForm } from '@/components/auth/LoginForm';
import { signIn } from 'next-auth/react';

vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
}));

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  useSearchParams: () => new URLSearchParams(),
}));

describe('LoginForm Component (Black & Gold CRM Parity)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders with Capital Bridge HRM title, gold lock badge, and inputs', () => {
    render(<LoginForm />);
    expect(screen.getByText('Capital Bridge HRM')).toBeDefined();
    expect(screen.getByText(/enter your credentials/i)).toBeDefined();
    expect(screen.getByLabelText(/corporate email/i)).toBeDefined();
    expect(screen.getByLabelText(/^password/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /sign in to shift portal/i })).toBeDefined();
  });

  it('toggles password visibility when the eye button is clicked', () => {
    render(<LoginForm />);
    const passwordInput = screen.getByLabelText(/^password/i) as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    const toggleBtn = screen.getByRole('button', { name: /toggle password visibility/i });
    fireEvent.click(toggleBtn);
    expect(passwordInput.type).toBe('text');

    fireEvent.click(toggleBtn);
    expect(passwordInput.type).toBe('password');
  });

  it('submits credentials and routes to dashboard on success', async () => {
    vi.mocked(signIn).mockResolvedValueOnce({
      error: undefined,
      code: undefined,
      status: 200,
      ok: true,
      url: '/dashboard',
    });

    render(<LoginForm />);
    const emailInput = screen.getByLabelText(/corporate email/i);
    const passwordInput = screen.getByLabelText(/^password/i);
    const submitBtn = screen.getByRole('button', { name: /sign in to shift portal/i });

    fireEvent.change(emailInput, { target: { value: 'broker@capitalbridgelogistics.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith('credentials', {
        email: 'broker@capitalbridgelogistics.com',
        password: 'password123',
        redirect: false,
        callbackUrl: '/dashboard',
      });
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('displays error banner if credentials are invalid', async () => {
    vi.mocked(signIn).mockResolvedValueOnce({
      error: 'CredentialsSignin',
      code: 'credentials',
      status: 401,
      ok: false,
      url: null,
    });

    render(<LoginForm />);
    const emailInput = screen.getByLabelText(/corporate email/i);
    const passwordInput = screen.getByLabelText(/^password/i);
    const submitBtn = screen.getByRole('button', { name: /sign in to shift portal/i });

    fireEvent.change(emailInput, { target: { value: 'wrong@capitalbridgelogistics.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeDefined();
    });
  });
});
