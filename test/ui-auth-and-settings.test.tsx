import * as React from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  renderClient,
  cleanupClients,
  clickElement,
  typeIntoInput,
  submitForm,
  pressKey,
} from './helpers/render';

// --- External boundary mocks ---
const mockRouterPush = vi.fn();
const mockRouterReplace = vi.fn();
const mockRouterRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    refresh: mockRouterRefresh,
  }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/',
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockToastInfo = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
  },
}));

const mockCreateBrowserClient = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockCreateBrowserClient(),
}));

const mockCreateServerClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateServerClient(),
}));

const mockGetUserRole = vi.fn();
vi.mock('@/lib/auth-helpers', () => ({
  getUserRole: () => mockGetUserRole(),
}));

const mockGetAcademicPrograms = vi.fn();
const mockSubmitOnboarding = vi.fn();
vi.mock('@/lib/actions/onboarding', () => ({
  getAcademicPrograms: (...args: unknown[]) => mockGetAcademicPrograms(...args),
  submitOnboarding: (...args: unknown[]) => mockSubmitOnboarding(...args),
}));

const mockUpdateAvatarUrl = vi.fn();
vi.mock('@/lib/actions/profile', () => ({
  updateAvatarUrl: (...args: unknown[]) => mockUpdateAvatarUrl(...args),
}));

// Components under test
import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { AuthButton } from '@/components/auth/AuthButton';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { UpdatePasswordForm } from '@/components/auth/UpdatePasswordForm';
import { OnboardingForm } from '@/components/auth/OnboardingForm';
import { AccountPendingScreen } from '@/components/auth/AccountPendingScreen';
import { SettingsShell } from '@/components/settings/SettingsShell';
import {
  Section,
  AnnualResetTool,
  RunMaintenanceTool,
  TestEmailTool,
} from '@/components/settings/SettingsShared';
import { ImageCropper } from '@/components/settings/profile/ImageCropper';
import { AvatarManager } from '@/components/settings/profile/AvatarManager';
import { PersonalInfoForm } from '@/components/settings/profile/PersonalInfoForm';
import { ProfileSection } from '@/components/settings/sections/ProfileSection';
import { SecuritySection } from '@/components/settings/sections/SecuritySection';
import { PoliciesSection } from '@/components/settings/sections/PoliciesSection';
import { PreferencesProvider } from '@/components/providers/PreferencesProvider';
import { DEFAULT_POLICIES } from '@/lib/actions/policy-constants';
import type { Category, PolicySetting } from '@/types/admin';
import { Shield } from 'lucide-react';

// Polyfill DOM APIs missing in jsdom for Radix primitives & react-easy-crop
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
if (typeof Element !== 'undefined') {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}

function findButtonByText(root: ParentNode, text: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find((btn) =>
    btn.textContent?.toLowerCase().includes(text.toLowerCase())
  ) as HTMLButtonElement | undefined;
}

function createDefaultBrowserSupabase() {
  return {
    auth: {
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1', email: 'student@lumina.edu' } },
      }),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://example.com/avatars/user-1/new.jpg' },
        }),
        list: vi.fn().mockResolvedValue({ data: [] }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }),
    removeChannel: vi.fn(),
  };
}

describe('Auth & Settings UI Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateBrowserClient.mockReturnValue(createDefaultBrowserSupabase());
    mockGetAcademicPrograms.mockResolvedValue([
      'BS Information Technology',
      'BS Computer Science',
    ]);
    mockSubmitOnboarding.mockResolvedValue({ success: true });
    mockUpdateAvatarUrl.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    cleanupClients();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('AuthPageShell', () => {
    it('renders brand header, main content, footer, and optional title/description', async () => {
      const handle = await renderClient(
        <AuthPageShell title="Sign in" description="Access your library account">
          <div data-testid="child">Form Body</div>
        </AuthPageShell>
      );

      expect(handle.container).toHaveTextContent('Lumina LMS');
      expect(handle.container).toHaveTextContent('© 2026 Lumina LMS');
      expect(handle.container.querySelector('h1')).toHaveTextContent('Sign in');
      expect(handle.container).toHaveTextContent('Access your library account');
      expect(handle.container.querySelector('main')).toHaveTextContent('Form Body');

      await handle.rerender(
        <AuthPageShell>
          <div data-testid="child">Only Child</div>
        </AuthPageShell>
      );

      expect(handle.container.querySelector('h1')).toBeNull();
      expect(handle.container.querySelector('main')).toHaveTextContent('Only Child');
    });
  });

  describe('AuthButton', () => {
    it('returns null when no user is authenticated', async () => {
      mockCreateServerClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      });

      const ui = await AuthButton();
      expect(ui).toBeNull();
    });

    it('fetches role and profile in parallel and renders UserNav when authenticated', async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: { full_name: 'Maria Clara', avatar_url: null },
      });
      const eqMock = vi.fn().mockReturnValue({ single: singleMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      const fromMock = vi.fn().mockReturnValue({ select: selectMock });

      mockCreateServerClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'u-42', email: 'maria@lumina.edu' } },
          }),
        },
        from: fromMock,
      });
      mockGetUserRole.mockResolvedValue('librarian');

      const ui = await AuthButton();
      const { container } = await renderClient(ui as React.ReactElement);

      expect(fromMock).toHaveBeenCalledWith('profiles');
      expect(eqMock).toHaveBeenCalledWith('id', 'u-42');
      const trigger = container.querySelector('button[aria-label*="Maria Clara"]');
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveAttribute('aria-label', 'MC — account menu for Maria Clara');
    });
  });

  describe('ForgotPasswordForm', () => {
    it('shows loading state, sends reset email, and displays confirmation view on success', async () => {
      let resolveReset!: (value: { error: null }) => void;
      const resetMock = vi.fn(
        () =>
          new Promise<{ error: null }>((resolve) => {
            resolveReset = resolve;
          })
      );
      mockCreateBrowserClient.mockReturnValue({
        ...createDefaultBrowserSupabase(),
        auth: { resetPasswordForEmail: resetMock },
      });

      const { container } = await renderClient(<ForgotPasswordForm />);

      const emailInput = container.querySelector('#email') as HTMLInputElement;
      const submitBtn = findButtonByText(container, 'Send reset link')!;
      expect(submitBtn).toBeDefined();

      await typeIntoInput(emailInput, 'alice@lumina.edu');
      const form = container.querySelector('form')!;

      await act(async () => {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });

      expect(form).toHaveAttribute('aria-busy', 'true');
      expect(findButtonByText(container, 'Sending link...')).toBeDisabled();

      await act(async () => {
        resolveReset({ error: null });
      });

      expect(resetMock).toHaveBeenCalledWith('alice@lumina.edu', {
        redirectTo: `${window.location.origin}/update-password`,
      });
      const statusRegion = container.querySelector('[role="status"]');
      expect(statusRegion).toHaveTextContent('Check your email');
      expect(statusRegion).toHaveTextContent('alice@lumina.edu');
      const links = Array.from(container.querySelectorAll('a[href="/"]'));
      expect(links.some((a) => a.textContent?.includes('Return to sign in'))).toBe(true);
    });

    it('displays an alert message and re-enables submission when reset fails', async () => {
      const resetMock = vi.fn().mockResolvedValue({
        error: new Error('Rate limit exceeded'),
      });
      mockCreateBrowserClient.mockReturnValue({
        ...createDefaultBrowserSupabase(),
        auth: { resetPasswordForEmail: resetMock },
      });

      const { container } = await renderClient(<ForgotPasswordForm />);
      await typeIntoInput(container.querySelector('#email') as HTMLInputElement, 'bob@lumina.edu');
      await submitForm(container.querySelector('form'));

      const alert = container.querySelector('[role="alert"]');
      expect(alert).toHaveTextContent('Rate limit exceeded');
      expect(findButtonByText(container, 'Send reset link')).not.toBeDisabled();
    });
  });

  describe('UpdatePasswordForm', () => {
    it('toggles password visibility and redirects to /dashboard on update success', async () => {
      const updateUserMock = vi.fn().mockResolvedValue({ error: null });
      mockCreateBrowserClient.mockReturnValue({
        ...createDefaultBrowserSupabase(),
        auth: { updateUser: updateUserMock },
      });

      const { container } = await renderClient(<UpdatePasswordForm />);
      const passwordInput = container.querySelector('#password') as HTMLInputElement;
      expect(passwordInput.type).toBe('password');

      const toggleBtn = container.querySelector('button[aria-label="Show password"]')!;
      await clickElement(toggleBtn);
      expect(passwordInput.type).toBe('text');
      expect(container.querySelector('button[aria-label="Hide password"]')).toBeInTheDocument();

      await clickElement(container.querySelector('button[aria-label="Hide password"]'));
      expect(passwordInput.type).toBe('password');

      await typeIntoInput(passwordInput, 'Str0ngPass!23');
      await submitForm(container.querySelector('form'));

      expect(updateUserMock).toHaveBeenCalledWith({ password: 'Str0ngPass!23' });
      expect(mockRouterPush).toHaveBeenCalledWith('/dashboard');
    });

    it('renders alert and resets loading state when updateUser returns an error', async () => {
      const updateUserMock = vi.fn().mockResolvedValue({
        error: new Error('Password should be at least 6 characters'),
      });
      mockCreateBrowserClient.mockReturnValue({
        ...createDefaultBrowserSupabase(),
        auth: { updateUser: updateUserMock },
      });

      const { container } = await renderClient(<UpdatePasswordForm />);
      await typeIntoInput(container.querySelector('#password') as HTMLInputElement, '123');
      await submitForm(container.querySelector('form'));

      expect(container.querySelector('[role="alert"]')).toHaveTextContent(
        'Password should be at least 6 characters'
      );
      expect(findButtonByText(container, 'Update password')).not.toBeDisabled();
      expect(mockRouterPush).not.toHaveBeenCalled();
    });
  });

  describe('OnboardingForm', () => {
    it('loads academic programs, sanitizes phone input to <= 11 digits, and validates required fields', async () => {
      const { container } = await renderClient(<OnboardingForm />);
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockGetAcademicPrograms).toHaveBeenCalledTimes(1);

      const phoneInput = container.querySelector('#phone') as HTMLInputElement;
      await typeIntoInput(phoneInput, '09ab12-3456789');
      expect(phoneInput.value).toBe('09123456789');
      // Typing a 12th digit is ignored by the 11-digit cap
      await typeIntoInput(phoneInput, '091234567899');
      expect(phoneInput.value).toBe('09123456789');

      // Submit without address / department -> toast error, no server action call
      await typeIntoInput(container.querySelector('#address') as HTMLInputElement, '');
      await submitForm(container.querySelector('form'));

      expect(mockToastError).toHaveBeenCalledWith('Please fill in all required fields');
      expect(mockSubmitOnboarding).not.toHaveBeenCalled();
    });

    it('submits valid onboarding form, shows success screen, and reloads page', async () => {
      vi.useFakeTimers();
      const reloadSpy = vi.fn();
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...window.location, reload: reloadSpy },
      });

      const { container } = await renderClient(
        <OnboardingForm
          initialData={{
            address: '123 Rizal St',
            phone: '09171234567',
            department: 'BS Computer Science',
          }}
        />
      );
      await act(async () => {
        await Promise.resolve();
      });

      await submitForm(container.querySelector('form'));

      expect(mockSubmitOnboarding).toHaveBeenCalledWith({
        address: '123 Rizal St',
        phone: '09171234567',
        department: 'BS Computer Science',
      });
      expect(mockToastSuccess).toHaveBeenCalledWith('Profile submitted successfully!');
      expect(container).toHaveTextContent('Information Received');

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });
      expect(reloadSpy).toHaveBeenCalledTimes(1);
    });

    it('selects an academic program from Radix Select and surfaces submission errors', async () => {
      mockSubmitOnboarding.mockRejectedValueOnce(new Error('Network unavailable'));

      const { container } = await renderClient(<OnboardingForm />);
      await act(async () => {
        await Promise.resolve();
      });

      await typeIntoInput(container.querySelector('#address') as HTMLInputElement, '45 Mabini Ave');
      await typeIntoInput(container.querySelector('#phone') as HTMLInputElement, '09181112222');

      const trigger = container.querySelector('#program') as HTMLButtonElement;
      await clickElement(trigger);
      // Radix Select opens via pointerDown or keyboard; press Enter if pointer click didn't open
      if (trigger.getAttribute('aria-expanded') !== 'true') {
        await pressKey(trigger, 'Enter');
      }

      const option = Array.from(document.body.querySelectorAll('[role="option"]')).find((el) =>
        el.textContent?.includes('BS Information Technology')
      );
      expect(option).toBeDefined();
      await clickElement(option);

      await submitForm(container.querySelector('form'));

      expect(mockSubmitOnboarding).toHaveBeenCalledWith({
        address: '45 Mabini Ave',
        phone: '09181112222',
        department: 'BS Information Technology',
      });
      expect(mockToastError).toHaveBeenCalledWith('Network unavailable');
    });
  });

  describe('AccountPendingScreen', () => {
    it('renders OnboardingForm directly when a student has incomplete onboarding fields', async () => {
      const { container } = await renderClient(
        <AccountPendingScreen
          isStudent={true}
          profile={{ onboarding_completed: false, address: null, phone: null, department: null }}
        />
      );
      await act(async () => {
        await Promise.resolve();
      });

      expect(container).toHaveTextContent('Complete Your Profile');
      expect(container).not.toHaveTextContent('Activation Required');
    });

    it('renders activation card for completed student, toggles Edit Info, reloads Status, and signs out', async () => {
      const reloadSpy = vi.fn();
      let assignedHref = '';
      const locationMock = {
        ...window.location,
        reload: reloadSpy,
        get href() {
          return assignedHref || 'http://localhost:3000/';
        },
        set href(val: string) {
          assignedHref = val;
        },
      };
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: locationMock,
      });

      let resolveSignOut!: () => void;
      const signOutMock = vi.fn(
        () =>
          new Promise<{ error: null }>((resolve) => {
            resolveSignOut = () => resolve({ error: null });
          })
      );
      mockCreateBrowserClient.mockReturnValue({
        ...createDefaultBrowserSupabase(),
        auth: { signOut: signOutMock },
      });

      const { container } = await renderClient(
        <AccountPendingScreen
          isStudent={true}
          profile={{
            onboarding_completed: true,
            address: '100 Luna St',
            phone: '09170000000',
            department: 'BS Computer Science',
          }}
        />
      );

      expect(container).toHaveTextContent('Activation Required');
      expect(container).toHaveTextContent('Present your ID');

      // Status button reloads window
      await clickElement(findButtonByText(container, 'Status'));
      expect(reloadSpy).toHaveBeenCalledTimes(1);

      // Edit Info toggles to OnboardingForm + Cancel and Return
      await clickElement(findButtonByText(container, 'Edit Info'));
      await act(async () => {
        await Promise.resolve();
      });
      expect(container).toHaveTextContent('Complete Your Profile');
      const cancelBtn = findButtonByText(container, 'Cancel and Return');
      expect(cancelBtn).toBeInTheDocument();

      await clickElement(cancelBtn);
      expect(container).toHaveTextContent('Activation Required');

      // Sign Out button invokes supabase.auth.signOut and shows loading label
      vi.useFakeTimers();
      const signOutBtn = findButtonByText(container, 'Sign Out')!;
      await act(async () => {
        signOutBtn.click();
      });
      expect(findButtonByText(container, 'Signing out...')).toBeDisabled();
      expect(signOutMock).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveSignOut();
      });
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      expect(assignedHref).toBe('/');
    });

    it('renders activation card immediately for non-students even without onboarding fields', async () => {
      const { container } = await renderClient(
        <AccountPendingScreen isStudent={false} profile={{}} />
      );
      expect(container).toHaveTextContent('Activation Required');
    });
  });

  describe('SettingsShell & SettingsShared', () => {
    it('SettingsShell wires NavigationGuard to intercept internal links only when isDirty is true', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      const handle = await renderClient(
        <SettingsShell isDirty={true}>
          <a href="/dashboard">Go Dashboard</a>
        </SettingsShell>
      );

      const link = handle.container.querySelector('a[href="/dashboard"]') as HTMLAnchorElement;
      let clickCancelled = false;
      await act(async () => {
        const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
        link.dispatchEvent(evt);
        clickCancelled = evt.defaultPrevented;
      });
      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(clickCancelled).toBe(true);

      // beforeunload prevents unload when dirty
      const beforeUnloadEvt = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(beforeUnloadEvt);
      expect(beforeUnloadEvt.defaultPrevented).toBe(true);

      // Clean state does not prompt confirm
      confirmSpy.mockClear();
      await handle.rerender(
        <SettingsShell isDirty={false}>
          <a href="/dashboard">Go Dashboard</a>
        </SettingsShell>
      );
      await act(async () => {
        const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
        link.dispatchEvent(evt);
        clickCancelled = evt.defaultPrevented;
      });
      expect(confirmSpy).not.toHaveBeenCalled();
    });

    it('Section renders title, icon, and danger styling when specified', async () => {
      const { container } = await renderClient(
        <Section title="Danger Zone" icon={Shield} danger hideHeaderOnMobile>
          <div>Section Body</div>
        </Section>
      );
      const heading = container.querySelector('h2');
      expect(heading).toHaveTextContent('Danger Zone');
      expect(heading?.className).toContain('text-red-600');
      expect(container).toHaveTextContent('Section Body');
    });

    it('AnnualResetTool checks confirmation, calls POST /api/admin/annual-reset, and handles success/error', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const { container } = await renderClient(<AnnualResetTool />);
      const resetBtn = findButtonByText(container, 'Execute Reset')!;

      // Cancelled confirmation -> no fetch
      await clickElement(resetBtn);
      expect(fetchSpy).not.toHaveBeenCalled();

      // Confirmed -> fetch succeeds
      confirmSpy.mockReturnValueOnce(true);
      await clickElement(resetBtn);
      expect(fetchSpy).toHaveBeenCalledWith('/api/admin/annual-reset', { method: 'POST' });
      expect(mockToastSuccess).toHaveBeenCalledWith('Reset complete.');

      // Confirmed -> fetch error
      confirmSpy.mockReturnValueOnce(true);
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Forbidden' }),
      } as Response);
      await clickElement(resetBtn);
      expect(mockToastError).toHaveBeenCalledWith('Forbidden');
    });

    it('RunMaintenanceTool dispatches POST /api/notifications/maintenance and toasts outcome', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ remindersSent: 3, overdueTagged: 2 }),
      } as Response);

      const { container } = await renderClient(<RunMaintenanceTool />);
      const runBtn = findButtonByText(container, 'Run Task')!;
      await clickElement(runBtn);

      expect(fetchSpy).toHaveBeenCalledWith('/api/notifications/maintenance', { method: 'POST' });
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Dispatch complete: 3 reminders and 2 overdue notices processed.'
      );

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ remindersSent: 1, overdueTagged: 0, errors: ['Mail timeout'] }),
      } as Response);
      await clickElement(runBtn);
      expect(mockToastError).toHaveBeenCalledWith('Dispatch completed with errors: Mail timeout');

      fetchSpy.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'SMTP down' }),
      } as Response);
      await clickElement(runBtn);
      expect(mockToastError).toHaveBeenCalledWith('SMTP down');
    });

    it('TestEmailTool disables send when email is empty and sends selected email payload', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Dispatched test email' }),
      } as Response);

      const { container } = await renderClient(<TestEmailTool />);
      const sendBtn = findButtonByText(container, 'Send Test Email')!;
      expect(sendBtn).toBeDisabled();

      const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
      await typeIntoInput(emailInput, '  admin@lumina.edu  ');
      expect(sendBtn).not.toBeDisabled();

      await clickElement(sendBtn);
      expect(fetchSpy).toHaveBeenCalledWith('/api/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@lumina.edu', type: 'test' }),
      });
      expect(mockToastSuccess).toHaveBeenCalledWith('Dispatched test email');

      // Failure uses 8000ms toast duration
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid credentials' }),
      } as Response);
      await clickElement(sendBtn);
      expect(mockToastError).toHaveBeenCalledWith('Invalid credentials', { duration: 8000 });
    });
  });

  describe('ImageCropper & AvatarManager', () => {
    function stubCanvasAndImage(options?: { failBlob?: boolean }) {
      const fakeCtx = {
        drawImage: vi.fn(),
      } as unknown as CanvasRenderingContext2D;
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeCtx);
      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => {
        cb(options?.failBlob ? null : new Blob(['cropped-bytes'], { type: 'image/jpeg' }));
      });

      const OrigImage = globalThis.Image;
      class MockLoadedImage extends OrigImage {
        constructor() {
          super();
          Object.defineProperty(this, 'naturalWidth', { value: 400, configurable: true });
          Object.defineProperty(this, 'naturalHeight', { value: 400, configurable: true });
          Object.defineProperty(this, 'width', { value: 400, configurable: true });
          Object.defineProperty(this, 'height', { value: 400, configurable: true });
          setTimeout(() => {
            if (this.getAttribute('src')) {
              this.dispatchEvent(new Event('load'));
            }
          }, 0);
        }
      }
      vi.stubGlobal('Image', MockLoadedImage);
      return () => {
        vi.stubGlobal('Image', OrigImage);
      };
    }

    it('ImageCropper renders controls, cancels, and invokes onCropComplete with cropped blob', async () => {
      const restoreImage = stubCanvasAndImage();
      try {
        const onCropComplete = vi.fn();
        const onCancel = vi.fn();

        await renderClient(
          <ImageCropper
            image="data:image/png;base64,iVBORw0KGgo="
            onCropComplete={onCropComplete}
            onCancel={onCancel}
          />
        );

        const dialog = document.body.querySelector('[role="dialog"]')!;
        expect(dialog).toHaveTextContent('Adjust Profile Photo');
        expect(dialog).toHaveTextContent('100%');

        // Trigger image load inside react-easy-crop so croppedAreaPixels is populated
        const cropImg = dialog.querySelector('img') as HTMLImageElement;
        expect(cropImg).not.toBeNull();
        Object.defineProperty(cropImg, 'naturalWidth', { value: 400, configurable: true });
        Object.defineProperty(cropImg, 'naturalHeight', { value: 400, configurable: true });
        await act(async () => {
          cropImg.dispatchEvent(new Event('load'));
        });

        // Exercise movement buttons
        await clickElement(findButtonByText(dialog, 'Left'));
        await clickElement(findButtonByText(dialog, 'Right'));

        // Save Changes runs getCroppedImg and returns the blob
        await clickElement(findButtonByText(dialog, 'Save Changes'));
        await act(async () => {
          await new Promise((r) => setTimeout(r, 20));
        });

        expect(onCropComplete).toHaveBeenCalledTimes(1);
        expect(onCropComplete.mock.calls[0][0]).toBeInstanceOf(Blob);

        await clickElement(findButtonByText(dialog, 'Cancel'));
        expect(onCancel).toHaveBeenCalledTimes(1);
      } finally {
        restoreImage();
      }
    });

    it('ImageCropper displays an alert when cropping fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const restoreImage = stubCanvasAndImage({ failBlob: true });
      try {
        const onCropComplete = vi.fn();
        await renderClient(
          <ImageCropper
            image="data:image/png;base64,iVBORw0KGgo="
            onCropComplete={onCropComplete}
            onCancel={vi.fn()}
          />
        );

        const dialog = document.body.querySelector('[role="dialog"]')!;
        const cropImg = dialog.querySelector('img') as HTMLImageElement;
        Object.defineProperty(cropImg, 'naturalWidth', { value: 400, configurable: true });
        Object.defineProperty(cropImg, 'naturalHeight', { value: 400, configurable: true });
        await act(async () => {
          cropImg.dispatchEvent(new Event('load'));
        });

        await clickElement(findButtonByText(dialog, 'Save Changes'));
        await act(async () => {
          await new Promise((r) => setTimeout(r, 20));
        });

        expect(onCropComplete).not.toHaveBeenCalled();
        expect(dialog.querySelector('[role="alert"]')).toHaveTextContent(
          'The photo could not be cropped. Try again or choose another image.'
        );
      } finally {
        restoreImage();
        consoleErrorSpy.mockRestore();
      }
    });

    it('AvatarManager rejects non-image files, handles upload errors, and uploads cropped image', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const restoreImage = stubCanvasAndImage();
      try {
        const uploadMock = vi.fn().mockResolvedValue({ error: null });
        const getPublicUrlMock = vi.fn().mockReturnValue({
          data: { publicUrl: 'https://placeholder.supabase.co/storage/v1/object/public/avatars/user-1/new.jpg' },
        });
        const listMock = vi.fn().mockResolvedValue({
          data: [{ name: '1700000000000.jpg' }, { name: 'card.webp' }],
        });
        const removeMock = vi.fn().mockResolvedValue({ error: null });

        mockCreateBrowserClient.mockReturnValue({
          ...createDefaultBrowserSupabase(),
          storage: {
            from: vi.fn().mockReturnValue({
              upload: uploadMock,
              getPublicUrl: getPublicUrlMock,
              list: listMock,
              remove: removeMock,
            }),
          },
        });

        const { container } = await renderClient(
          <PreferencesProvider
            initialPreferences={{ loaded: true }}
            initialRole="student"
            initialProfile={{
              id: 'user-1',
              full_name: 'Jane Doe',
              avatar_url: null,
              student_id: null,
              department: null,
              address: null,
              phone: null,
              updated_at: '2026-01-01T00:00:00Z',
            }}
          >
            <AvatarManager initialAvatarUrl={null} fullName="Jane Doe" />
          </PreferencesProvider>
        );
        await act(async () => {
          await Promise.resolve();
        });

        expect(container).toHaveTextContent('Profile Identity');
        expect(container).toHaveTextContent('Click to update photo');

        const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

        // 1. Reject non-image file
        const textFile = new File(['hello'], 'notes.txt', { type: 'text/plain' });
        await act(async () => {
          Object.defineProperty(fileInput, 'files', { value: [textFile], configurable: true });
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        });
        expect(mockToastError).toHaveBeenCalledWith('Please upload an image file.');
        expect(document.body.querySelector('[role="dialog"]')).toBeNull();

        // 2. Accept image file -> FileReader opens ImageCropper -> Save Changes uploads & updates profile
        const imgFile = new File(['png-bytes'], 'avatar.png', { type: 'image/png' });
        await act(async () => {
          Object.defineProperty(fileInput, 'files', { value: [imgFile], configurable: true });
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));
          await new Promise((r) => setTimeout(r, 30));
        });

        const dialog = document.body.querySelector('[role="dialog"]')!;
        expect(dialog).toBeInTheDocument();

        const cropImg = dialog.querySelector('img') as HTMLImageElement;
        Object.defineProperty(cropImg, 'naturalWidth', { value: 400, configurable: true });
        Object.defineProperty(cropImg, 'naturalHeight', { value: 400, configurable: true });
        await act(async () => {
          cropImg.dispatchEvent(new Event('load'));
        });

        await clickElement(findButtonByText(dialog, 'Save Changes'));
        await act(async () => {
          await new Promise((r) => setTimeout(r, 30));
        });

        expect(uploadMock).toHaveBeenCalledTimes(1);
        expect(mockUpdateAvatarUrl).toHaveBeenCalledWith(
          'https://placeholder.supabase.co/storage/v1/object/public/avatars/user-1/new.jpg'
        );
        expect(removeMock).toHaveBeenCalledWith(['user-1/1700000000000.jpg']);
        expect(mockToastSuccess).toHaveBeenCalledWith('Profile picture updated.');

        // 3. Upload failure surfaces toast.error and skips updateAvatarUrl
        mockUpdateAvatarUrl.mockClear();
        uploadMock.mockResolvedValueOnce({ error: new Error('Bucket quota exceeded') });
        await act(async () => {
          Object.defineProperty(fileInput, 'files', { value: [imgFile], configurable: true });
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));
          await new Promise((r) => setTimeout(r, 30));
        });
        const retryDialog = document.body.querySelector('[role="dialog"]')!;
        const retryImg = retryDialog.querySelector('img') as HTMLImageElement;
        Object.defineProperty(retryImg, 'naturalWidth', { value: 400, configurable: true });
        Object.defineProperty(retryImg, 'naturalHeight', { value: 400, configurable: true });
        await act(async () => {
          retryImg.dispatchEvent(new Event('load'));
        });
        await clickElement(findButtonByText(retryDialog, 'Save Changes'));
        await act(async () => {
          await new Promise((r) => setTimeout(r, 30));
        });
        expect(mockUpdateAvatarUrl).not.toHaveBeenCalled();
        expect(mockToastError).toHaveBeenCalledWith('Bucket quota exceeded');
      } finally {
        restoreImage();
        consoleErrorSpy.mockRestore();
      }
    });
  });

  describe('PersonalInfoForm, ProfileSection & SecuritySection', () => {
    it('PersonalInfoForm renders student academic program and fallback labels for missing fields', async () => {
      const handle = await renderClient(
        <PersonalInfoForm
          role="student"
          initialProfile={{
            full_name: 'Juan Dela Cruz',
            student_id: '2026-0012',
            email: 'juan@lumina.edu',
            status: 'ACTIVE',
          }}
          addressValue="123 Taft Ave"
          phoneValue="09171234567"
          departmentValue="BS Information Technology"
        />
      );

      expect(handle.container).toHaveTextContent('Juan Dela Cruz');
      expect(handle.container).toHaveTextContent('2026-0012');
      expect(handle.container).toHaveTextContent('juan@lumina.edu');
      expect(handle.container).toHaveTextContent('ACTIVE');
      expect(handle.container).toHaveTextContent('09171234567');
      expect(handle.container).toHaveTextContent('123 Taft Ave');
      expect(handle.container).toHaveTextContent('Academic Program');
      expect(handle.container).toHaveTextContent('BS Information Technology');

      // Non-student hides Academic Program and shows fallbacks when values are null/empty
      await handle.rerender(
        <PersonalInfoForm
          role="librarian"
          initialProfile={{
            full_name: null,
            student_id: null,
            email: null,
            status: 'PENDING',
          }}
          addressValue=""
          phoneValue=""
          departmentValue=""
        />
      );

      expect(handle.container).toHaveTextContent('Not Set');
      expect(handle.container).toHaveTextContent('NOT-ASSIGNED');
      expect(handle.container).toHaveTextContent('No Email');
      expect(handle.container).toHaveTextContent('PENDING');
      expect(handle.container).not.toHaveTextContent('Academic Program');
    });

    it('ProfileSection composes AvatarManager, PersonalInfoForm, membership role, and security badge', async () => {
      const { container } = await renderClient(
        <PreferencesProvider initialPreferences={{ loaded: true }}>
          <ProfileSection
            role="super_admin"
            initialProfile={{
              full_name: 'Admin User',
              avatar_url: null,
              address: 'Admin Bldg',
              phone: '09170001111',
              department: null,
              status: 'ACTIVE',
              student_id: 'ADMIN-01',
              email: 'admin@lumina.edu',
            }}
          />
        </PreferencesProvider>
      );

      expect(container).toHaveTextContent('Admin User');
      expect(container).toHaveTextContent('Current Membership');
      expect(container).toHaveTextContent('super admin');
      expect(container).toHaveTextContent('Security Status');
      expect(container).toHaveTextContent('Verified');
    });

    it('SecuritySection renders role-specific credential management text', async () => {
      const handle = await renderClient(<SecuritySection role="student" />);
      expect(handle.container).toHaveTextContent('Identity & Access');
      expect(handle.container).toHaveTextContent('managed by the school system');

      await handle.rerender(<SecuritySection role="librarian" />);
      expect(handle.container).toHaveTextContent('credentials and access permissions are managed by the system');
    });
  });

  describe('PoliciesSection', () => {
    const baseSettings: PolicySetting[] = [
      { id: 'set-1', key: 'loan_period_days', value: '14', description: 'Loan days', updated_at: '' },
      { id: 'set-2', key: 'max_borrow_limit', value: '5', description: 'Max borrow', updated_at: '' },
      { id: 'set-3', key: 'overdue_fine_per_day', value: '5', description: 'Fine', updated_at: '' },
      { id: 'set-4', key: 'hold_expiry_days', value: '7', description: 'Hold expiry', updated_at: '' },
    ];
    const baseCategories: Category[] = [
      { id: 'cat-1', name: 'Science', slug: 'science', description: 'Science books', created_at: '' },
    ];

    it('renders categories for super_admin, allows editing & committing policies, and blocks invalid drafts', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      let handle!: Awaited<ReturnType<typeof renderClient>>;
      await act(async () => {
        handle = await renderClient(
          <PoliciesSection
            role="super_admin"
            settingsPromise={Promise.resolve(baseSettings)}
            categoriesPromise={Promise.resolve(baseCategories)}
          />
        );
      });

      expect(handle.container).toHaveTextContent(DEFAULT_POLICIES.loan_period_days.label);
      expect(handle.container).toHaveTextContent('Lifecycle');

      // Edit Borrowing Duration from 14 -> 21
      const inputs = Array.from(handle.container.querySelectorAll('input')) as HTMLInputElement[];
      const loanInput = inputs.find((inp) => inp.value === '14')!;
      expect(loanInput).toBeDefined();

      await typeIntoInput(loanInput, '21');
      expect(handle.container).toHaveTextContent('1 unsaved changes');

      // Attempting to switch category opens Unsaved Policy Changes dialog
      await clickElement(findButtonByText(handle.container, 'Reservations'));
      const unsavedDialog = document.body.querySelector('[role="dialog"]');
      expect(unsavedDialog).toHaveTextContent('Unsaved Policy Changes');
      await clickElement(findButtonByText(unsavedDialog!, 'Cancel'));

      // Review Changes opens PolicyCommitModal
      await clickElement(findButtonByText(handle.container, 'Review Changes'));
      const commitDialog = document.body.querySelector('[role="dialog"]')!;
      expect(commitDialog).toBeInTheDocument();

      const reasonTextarea = commitDialog.querySelector('textarea') as HTMLTextAreaElement;
      await typeIntoInput(reasonTextarea, 'Extend semester loan period');
      const confirmBtn = Array.from(commitDialog.querySelectorAll('button')).find((b) =>
        b.textContent?.toLowerCase().includes('confirm') || b.textContent?.toLowerCase().includes('commit') || b.textContent?.toLowerCase().includes('apply')
      )!;
      expect(confirmBtn).toBeDefined();
      await clickElement(confirmBtn);

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/policy-settings',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
      expect(mockToastSuccess).toHaveBeenCalledWith('Changes synchronized');
    });

    it('hides Lifecycle for non-super_admin and disables policy inputs for students', async () => {
      let handle!: Awaited<ReturnType<typeof renderClient>>;
      await act(async () => {
        handle = await renderClient(
          <PoliciesSection
            role="student"
            settingsPromise={Promise.resolve(baseSettings)}
            categoriesPromise={Promise.resolve(baseCategories)}
          />
        );
      });

      expect(handle.container).not.toHaveTextContent('Lifecycle');
      const inputs = Array.from(handle.container.querySelectorAll('input')) as HTMLInputElement[];
      expect(inputs.length).toBeGreaterThan(0);
      expect(inputs.every((inp) => inp.disabled)).toBe(true);
    });

    it('switches to Lifecycle tab for super_admin and renders AnnualResetTool, RunMaintenanceTool, and TestEmailTool', async () => {
      let handle!: Awaited<ReturnType<typeof renderClient>>;
      await act(async () => {
        handle = await renderClient(
          <PoliciesSection
            role="super_admin"
            settingsPromise={Promise.resolve(baseSettings)}
            categoriesPromise={Promise.resolve(baseCategories)}
          />
        );
      });

      await clickElement(findButtonByText(handle.container, 'Lifecycle'));
      expect(handle.container).toHaveTextContent('Batch Account Reset');
      expect(handle.container).toHaveTextContent('Email Dispatch');
      expect(handle.container).toHaveTextContent('Email Configuration Test');
    });

    it('supports discarding policy edits, Discard & Move across categories, and resolving realtime conflicts', async () => {
      let handle!: Awaited<ReturnType<typeof renderClient>>;
      await act(async () => {
        handle = await renderClient(
          <PoliciesSection
            role="super_admin"
            settingsPromise={Promise.resolve(baseSettings)}
            categoriesPromise={Promise.resolve(baseCategories)}
          />
        );
      });

      const loanInput = Array.from(handle.container.querySelectorAll('input')).find(
        (inp) => (inp as HTMLInputElement).value === '14'
      ) as HTMLInputElement;

      // 1. Out-of-range input disables Review Changes
      await typeIntoInput(loanInput, '20');
      await typeIntoInput(loanInput, '999');
      expect(findButtonByText(handle.container, 'Review Changes')).toBeDisabled();

      // Fix to valid value and Discard
      await typeIntoInput(loanInput, '21');
      await clickElement(findButtonByText(handle.container, 'Discard'));
      expect(mockToastSuccess).toHaveBeenCalledWith('All unsaved changes discarded');
      expect(handle.container).not.toHaveTextContent('unsaved changes');

      // 2. Edit again and Discard & Move to Reservations
      const refreshedLoanInput = Array.from(handle.container.querySelectorAll('input')).find(
        (inp) => (inp as HTMLInputElement).value === '14'
      ) as HTMLInputElement;
      await typeIntoInput(refreshedLoanInput, '28');
      await clickElement(findButtonByText(handle.container, 'Reservations'));
      const unsavedDialog = document.body.querySelector('[role="dialog"]')!;
      await clickElement(findButtonByText(unsavedDialog, 'Discard & Move'));
      expect(mockToastSuccess).toHaveBeenCalledWith('Changes discarded');
      expect(handle.container).toHaveTextContent('Simulation Engine');

      // 3. Conflict resolution when server value updates while an edit is open
      const holdInput = Array.from(handle.container.querySelectorAll('input')).find(
        (inp) => (inp as HTMLInputElement).value === '7'
      ) as HTMLInputElement;
      await typeIntoInput(holdInput, '10');

      const updatedSettings = baseSettings.map((s) =>
        s.key === 'hold_expiry_days' ? { ...s, value: '5' } : s
      );
      await act(async () => {
        await handle.rerender(
          <PoliciesSection
            role="super_admin"
            settingsPromise={Promise.resolve(updatedSettings)}
            categoriesPromise={Promise.resolve(baseCategories)}
          />
        );
      });

      const conflictAlert = handle.container.querySelector('[role="alert"]');
      expect(conflictAlert).toHaveTextContent('Another administrator changed');
      expect(findButtonByText(handle.container, 'Review Changes')).toBeDisabled();

      await clickElement(findButtonByText(handle.container, 'Keep my edit'));
      expect(handle.container.querySelector('[role="alert"]')).toBeNull();
      expect(findButtonByText(handle.container, 'Review Changes')).not.toBeDisabled();
    });
  });
});
