'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { Html5Qrcode } from 'html5-qrcode';

const SAME_CODE_REARM_MS = 3000;

interface UseScannerProps {
  onScan: (value: string) => Promise<void>;
  isProcessing: boolean;
  scannerId: string;
}

export function useScanner({ onScan, isProcessing, scannerId }: UseScannerProps) {
  const instanceId = useId();
  const containerId = scannerId + '-' + instanceId.replace(/[^a-zA-Z0-9_-]/g, '');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraIssue, setCameraIssue] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [devices, setDevices] = useState<string[]>([]);
  const activeDevice = useRef<string | undefined>(undefined);
  const scanner = useRef<Html5Qrcode | null>(null);
  const generation = useRef(0);
  const queue = useRef(Promise.resolve());
  const last = useRef({ value: '', time: 0 });
  const processing = useRef(false);
  const callbacks = useRef({ onScan, isProcessing });
  useEffect(() => { callbacks.current = { onScan, isProcessing }; }, [onScan, isProcessing]);

  // Only one operation may own this scanner's video element at a time.
  const release = useCallback(async () => {
    const current = scanner.current;
    scanner.current = null;
    if (!current) return;
    try {
      if (current.isScanning) await current.stop();
    } catch (error) {
      console.warn('Could not stop QR scanner', error);
      const video = document.getElementById(containerId)?.querySelector('video');
      if (video?.srcObject instanceof MediaStream) video.srcObject.getTracks().forEach(track => track.stop());
    }
    try { current.clear(); } catch { /* Container can already be unmounted. */ }
  }, [containerId]);

  const stopCamera = useCallback(() => {
    ++generation.current;
    setCameraOpen(false);
    setIsInitializing(false);
    queue.current = queue.current.then(release);
    return queue.current;
  }, [release]);

  const startScanner = useCallback((deviceId?: string) => {
    const request = ++generation.current;
    const canceled = () => request !== generation.current;
    setCameraIssue(null);
    setCameraOpen(false);
    setIsInitializing(true);
    queue.current = queue.current.then(async () => {
      if (canceled()) return;
      try {
        await release();
        if (canceled()) return;
        if (!navigator.mediaDevices) throw new Error('Camera unavailable. Use a secure connection or enter the code manually.');
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        if (canceled()) return;
        const current = new Html5Qrcode(containerId, { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false });
        scanner.current = current;
        await current.start(deviceId || { facingMode: 'environment' }, {
          fps: 15,
          qrbox: (w, h) => {
            const size = Math.floor(Math.min(w, h) * 0.7);
            return { width: size, height: size };
          },
          aspectRatio: 1,
        }, async value => {
          if (canceled()) return;
          const time = Date.now();
          if (last.current.value === value && time - last.current.time < SAME_CODE_REARM_MS) {
            last.current.time = time;
            return;
          }
          if (processing.current || callbacks.current.isProcessing) return;
          last.current = { value, time };
          processing.current = true;
          try { await callbacks.current.onScan(value); }
          finally { processing.current = false; }
        }, () => {});
        if (canceled()) return;
        setCameraOpen(true);
        setIsInitializing(false);
        // Enumeration is optional. A working stream stays usable if it fails.
        activeDevice.current = current.getRunningTrackSettings().deviceId || deviceId;
        const inputs = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        if (!canceled()) setDevices(inputs.filter(d => d.kind === 'videoinput' && d.deviceId).map(d => d.deviceId));
      } catch (error) {
        if (canceled()) return;
        await release();
        if (canceled()) return;
        const detail = String(error);
        const message = /denied|notallowed|permission/i.test(detail)
          ? 'Camera access is blocked. Allow camera access or enter the code manually.'
          : /notfound|not found|no camera/i.test(detail)
            ? 'No camera found. Connect a camera or enter the code manually.'
            : 'Camera unavailable. Check the connection and camera permissions, or enter the code manually.';
        setCameraOpen(false);
        setCameraIssue(message);
      } finally {
        if (!canceled()) setIsInitializing(false);
      }
    });
    return queue.current;
  }, [containerId, release]);

  const switchCamera = () => {
    const index = devices.indexOf(activeDevice.current ?? '');
    if (devices.length > 1) void startScanner(devices[(index + 1) % devices.length]);
  };

  useEffect(() => () => { void stopCamera(); }, [stopCamera]);
  return { scannerId: containerId, cameraOpen, cameraIssue, isInitializing, startScanner, stopCamera, switchCamera, hasMultipleCameras: devices.length > 1 };
}
