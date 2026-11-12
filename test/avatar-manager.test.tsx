import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { AvatarManager } from '@/components/settings/profile/AvatarManager';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  remove: vi.fn().mockResolvedValue({ error: null }),
  update: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock('@/lib/actions/profile', () => ({ updateAvatarUrl: mocks.update }));
vi.mock('@/components/providers/PreferencesProvider', () => ({ usePreferences: () => ({ profile: null }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
  storage: { from: () => ({
    upload: async () => ({ error: null }),
    getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage/avatars/${path}` } }),
    list: async () => ({ data: [{ name: '123.jpg' }, { name: '456.jpg' }, { name: 'card.webp' }] }),
    remove: mocks.remove,
  }) },
}) }));
vi.mock('@/components/settings/profile/ImageCropper', () => ({
  ImageCropper: ({ onCropComplete }: { onCropComplete: (blob: Blob) => Promise<void> }) =>
    <button onClick={() => void onCropComplete(new Blob(['photo']))}>Save cropped photo</button>,
}));

it('preserves the processed profile picture while removing old uploads and refreshes the profile', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(Date, 'now').mockReturnValue(456);
  const el = document.body.appendChild(document.createElement('div'));
  const root = createRoot(el);
  try {
    await act(async () => root.render(<AvatarManager initialAvatarUrl={null} fullName="User" />));
    const input = el.querySelector('input')!;
    Object.defineProperty(input, 'files', { value: [new File(['image'], 'photo.jpg', { type: 'image/jpeg' })] });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 20));
    });
    const save = [...el.querySelectorAll('button')].find(button => button.textContent === 'Save cropped photo')!;
    await act(async () => save.click());
    expect(mocks.update).toHaveBeenCalledWith('https://storage/avatars/user-1/456.jpg');
    expect(mocks.remove).toHaveBeenCalledWith(['user-1/123.jpg']);
    expect(mocks.refresh).toHaveBeenCalledOnce();
  } finally {
    act(() => root.unmount());
    el.remove();
    vi.restoreAllMocks();
  }
});
