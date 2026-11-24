import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserAvatarDropdown } from '@/components/layout/UserAvatarDropdown';
import { signOut } from 'next-auth/react';

vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
}));

describe('UserAvatarDropdown Component', () => {
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

  it('renders user avatar button with initials', () => {
    render(<UserAvatarDropdown user={mockUser} />);
    const button = screen.getByRole('button', { name: /user account menu/i });
    expect(button).toBeDefined();
    expect(button.textContent).toContain('DB');
    // Verifies avatar button uses semantic bg-secondary and gold border matching CRM without hardcoded black fill in light mode
    expect(button.className).toContain('bg-secondary');
    expect(button.className).toContain('border-[#ffd700]');
  });

  it('displays user alias when present', () => {
    const userWithAlias = {
      ...mockUser,
      alias: 'Denver Jones',
    };
    render(<UserAvatarDropdown user={userWithAlias} />);
    const button = screen.getByRole('button', { name: /user account menu/i });
    expect(button.textContent).toContain('DJ');

    fireEvent.click(button);
    expect(screen.getByText('Denver Jones')).toBeDefined();
  });

  it('opens dropdown card upon clicking avatar button', () => {
    render(<UserAvatarDropdown user={mockUser} />);
    const button = screen.getByRole('button', { name: /user account menu/i });

    // Initially dropdown is closed
    expect(screen.queryByText('Denver Broker')).toBeNull();

    // Click to open
    fireEvent.click(button);

    expect(screen.getByText('Denver Broker')).toBeDefined();
    expect(screen.getByText('denver@capitalbridgelogistics.com')).toBeDefined();
    expect(screen.getByText('BROKER')).toBeDefined();
    expect(screen.getByText('Theme Mode')).toBeDefined();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeDefined();
  });

  it('triggers signOut and redirects to SLO endpoint when Sign Out button is clicked', async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: '', origin: 'http://localhost:3001' },
    });

    render(<UserAvatarDropdown user={mockUser} />);
    const button = screen.getByRole('button', { name: /user account menu/i });
    fireEvent.click(button);

    const signOutBtn = screen.getByRole('button', { name: /sign out/i });
    fireEvent.click(signOutBtn);

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledWith({ redirect: false });
      expect(window.location.href).toContain('/api/auth/slo');
    });

    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  it('closes dropdown when clicking outside', () => {
    render(
      <div>
        <div data-testid="outside">Outside Element</div>
        <UserAvatarDropdown user={mockUser} />
      </div>
    );

    const button = screen.getByRole('button', { name: /user account menu/i });
    fireEvent.click(button);
    expect(screen.getByText('Denver Broker')).toBeDefined();

    // Click outside
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByText('Denver Broker')).toBeNull();
  });
});
