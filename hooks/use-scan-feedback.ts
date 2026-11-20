'use client';

import { useCallback } from 'react';

export type ScanFeedbackType = 'success' | 'error';

/**
 * Reusable hook providing sensory feedback (haptic vibration and Web Audio synth cues)
 * for scanner operations across circulation, attendance, and inventory modules.
 */
export function useScanFeedback() {
  const playScanCue = useCallback((type: ScanFeedbackType) => {
    if (typeof window === 'undefined') return;

    if (type === 'success' && 'vibrate' in navigator) {
      navigator.vibrate([10, 50, 10]);
    } else if (type === 'error' && 'vibrate' in navigator) {
      navigator.vibrate(200);
    }

    const win = window as unknown as { AudioContext: typeof AudioContext; webkitAudioContext: typeof AudioContext };
    const AudioCtx = win.AudioContext || win.webkitAudioContext;
    if (!AudioCtx) return;

    try {
      const ctx = new AudioCtx();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(type === 'success' ? 880 : 220, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      oscillator.start(now);
      oscillator.stop(now + 0.16);
      void ctx.close();
    } catch {
      // Gracefully ignore audio context failures (e.g. autoplay policy restrictions)
    }
  }, []);

  return { playScanCue };
}
