import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Navbar } from '@/components/layout/Navbar';

vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
}));

describe('Navbar [Open CRM] SSO Bridge Button Component', () => {
  const mockUser = {
    id: 'usr_broker_1',
    name: 'Denver Broker',
    email: 'denver@capitalbridgelogistics.com',
    role: {
      code: 'BROKER',
      name: 'Freight Broker',
    },
    designation: {
      name: 'Senior Logistics Specialist',
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the [Open CRM] button', () => {
    render(<Navbar user={mockUser} />);
    const button = screen.getByRole('button', { name: /open crm/i });
    expect(button).toBeDefined();
    expect(button.textContent).toContain('Open CRM');
  });

  it('fetches sso token and opens CRM in new window upon click', async () => {
    const mockWindowOpen = vi.fn();
    window.open = mockWindowOpen;

    const fakeSsoUrl = 'http://localhost:3000/api/auth/sso?token=fake-test-jwt-token';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, ssoUrl: fakeSsoUrl }),
    });

    render(<Navbar user={mockUser} />);
    const button = screen.getByRole('button', { name: /open crm/i });

    fireEvent.click(button);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/sso/token');
      expect(mockWindowOpen).toHaveBeenCalledWith(fakeSsoUrl, '_blank', 'noopener,noreferrer');
    });
  });

  it('handles API errors gracefully and alerts user', async () => {
    const mockAlert = vi.fn();
    window.alert = mockAlert;

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () =>
        Promise.resolve({
          success: false,
          error: { code: 'AUTH_UNAUTHORIZED', message: 'You must be signed in' },
        }),
    });

    render(<Navbar user={mockUser} />);
    const button = screen.getByRole('button', { name: /open crm/i });

    fireEvent.click(button);

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith('You must be signed in');
    });
  });
});

