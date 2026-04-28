'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface UseScannerProps {
  onScan: (value: string) => Promise<void>;
  isProcessing: boolean;
  scannerId?: string;
  formats?: number[];
}

/**
 * useScanner - A robust cross-browser QR/Barcode scanning hook using html5-qrcode.
 * Replaces the experimental BarcodeDetector API which had poor Safari/Firefox support.
 */
export function useScanner({ 
  onScan, 
  isProcessing, 
  scannerId = 'qr-reader',
  formats = [0] // 0 is Html5QrcodeSupportedFormats.QR_CODE
}: UseScannerProps) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(true);
  const [cameraPermission, setCameraPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [cameraIssue, setCameraIssue] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [devices, setDevices] = useState<{ id: string; label: string }[]>([]);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ value: string; time: number } | null>(null);
  
  const onScanRef = useRef(onScan);
  const isProcessingRef = useRef(isProcessing);

  useEffect(() => {
    onScanRef.current = onScan;
    isProcessingRef.current = isProcessing;
  }, [onScan, isProcessing]);

  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      if (scannerRef.current.isScanning) {
        try {
          await scannerRef.current.stop();
        } catch (err) {
          console.warn('[Scanner] Failed to stop scanner cleanly:', err);
        }
      }
      try {
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }

    // Aggressive track cleanup to ensure the hardware is released
    // This fixes the "camera still in use" issue on mobile browsers
    try {
      const container = document.getElementById(scannerId);
      const videoElem = container?.querySelector('video') as HTMLVideoElement | null;
      
      if (videoElem && videoElem.srcObject instanceof MediaStream) {
        console.debug('[Scanner] Manually stopping tracks for:', scannerId);
        videoElem.srcObject.getTracks().forEach(track => {
          track.stop();
          console.debug(`[Scanner] Track stopped: ${track.kind} - ${track.label}`);
        });
        videoElem.srcObject = null;
      }
    } catch (e) {
      console.debug('[Scanner] Manual track cleanup failed:', e);
    }

    setCameraOpen(false);
    setIsInitializing(false);
  }, [scannerId]);

  const clearLastScan = useCallback(() => {
    lastScanRef.current = null;
  }, []);

  const startScanner = useCallback(async () => {
    if (isInitializing || (scannerRef.current && scannerRef.current.isScanning)) return;
    
    setIsInitializing(true);
    setCameraIssue(null);

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      
      // Cleanup any existing instance
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) await scannerRef.current.stop();
          scannerRef.current.clear();
        } catch {}
        scannerRef.current = null;
      }

      const html5QrCode = new Html5Qrcode(scannerId, { 
        formatsToSupport: formats as unknown as Html5QrcodeSupportedFormats[], 
        verbose: false 
      });
      scannerRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: (viewWidth: number, viewHeight: number) => {
          const min = Math.min(viewWidth, viewHeight);
          const boxSize = Math.floor(min * 0.7);
          return { width: boxSize, height: boxSize };
        },
        aspectRatio: 1.0,
      };

      await html5QrCode.start(
        { facingMode: facingMode },
        config,
        async (decodedText: string) => {
          const now = Date.now();
          console.info(`[Scanner] Detected: ${decodedText}`);

          if (isProcessingRef.current) {
            console.warn('[Scanner] Scan ignored: System is currently processing.');
            return;
          }

          if (lastScanRef.current?.value === decodedText && now - (lastScanRef.current?.time ?? 0) < 2000) {
            console.debug('[Scanner] Scan ignored: Debounce (duplicate).');
            return;
          }

          lastScanRef.current = { value: decodedText, time: now };
          console.info('[Scanner] Triggering onScan callback...');
          await onScanRef.current(decodedText);
          console.info('[Scanner] onScan callback completed.');
        },
        () => {}
      );

      setCameraOpen(true);
      setCameraPermission('granted');
      setCameraIssue(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isPermissionError = errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowedError');
      const isHardwareBusy = errorMessage.includes('NotReadableError') || 
                             errorMessage.includes('Could not start video source') ||
                             errorMessage.includes('Starting video source failed');
      const isNotFound = errorMessage.includes('NotFoundError') || errorMessage.includes('Devices not found');
      const isKnownError = isPermissionError || isHardwareBusy || isNotFound;

      if (isKnownError) {
        console.warn('[Scanner] Camera start failed (handled):', errorMessage);
      } else {
        console.error('Scanner start error:', err);
      }
      
      if (isPermissionError) {
        setCameraPermission('denied');
        setCameraIssue('Camera access denied. Please check browser permissions.');
      } else if (isHardwareBusy) {
        // NotReadableError often means the camera is busy, but if the user has no camera,
        // it means the browser is trying to open a "ghost" or virtual device driver.
        setCameraIssue('Camera is busy or failed to start. If you don\'t have a camera, your browser may be detecting a virtual device driver.');
      } else if (isNotFound) {
        setCameraSupported(false);
        setCameraIssue('No camera hardware detected on this device.');
      } else {
        setCameraIssue(errorMessage || 'Failed to start camera.');
      }
      
      void stopCamera();
    } finally {
      setIsInitializing(false);
    }
  }, [isInitializing, scannerId, formats, facingMode, stopCamera]);

  const switchCamera = useCallback(async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    
    if (cameraOpen) {
      await stopCamera();
      // Give it a small timeout to ensure the hardware is released
      setTimeout(() => startScanner(), 400);
    }
  }, [facingMode, cameraOpen, stopCamera, startScanner]);

  useEffect(() => {
    const checkSupport = async () => {
      if (typeof window === 'undefined' || !navigator.mediaDevices) {
        setCameraSupported(false);
        setCameraIssue('Camera API not supported in this browser.');
        return;
      }

      if (!window.isSecureContext && window.location.hostname !== 'localhost') {
        setCameraSupported(false);
        setCameraIssue('Camera only works on HTTPS or localhost.');
        return;
      }

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        
        
        console.info('[Scanner] Found video devices:', videoDevices.map(d => ({ label: d.label, id: d.deviceId })));

        if (videoDevices.length === 0) {
          setCameraSupported(false);
          return;
        }

        setCameraSupported(true);
        
        // Try to get formatted cameras from html5-qrcode for labels
        try {
          const { Html5Qrcode } = await import('html5-qrcode');
          const cameras = await Html5Qrcode.getCameras();
          setDevices(cameras || []);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('NotReadableError') || msg.includes('Could not start video source')) {
             console.debug('[Scanner] Camera is busy, but hardware detected.');
             setDevices(videoDevices.map((d, i) => ({ id: d.deviceId, label: d.label || `Camera ${i + 1}` })));
          } else {
             console.warn('[Scanner] Initial label fetch failed:', err);
          }
        }
      } catch (err) {
        console.warn('[Scanner] Initial support check failed:', err);
      }
    };

    void checkSupport();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        void stopCamera();
      }
    };
  }, [stopCamera]);

  return {
    cameraOpen,
    startScanner,
    stopCamera,
    isInitializing,
    cameraSupported,
    cameraPermission,
    cameraIssue,
    clearLastScan,
    switchCamera,
    facingMode,
    hasMultipleCameras: devices.length > 1,
    scannerId,
  };
}
