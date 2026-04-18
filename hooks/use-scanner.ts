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
  const [cameraSupported, setCameraSupported] = useState(true); // Default to true, will check on mount
  const [cameraPermission, setCameraPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [cameraIssue, setCameraIssue] = useState<string | null>(null);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ value: string; time: number } | null>(null);
  
  // Use refs for props that change frequently to avoid restarting the camera
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
          console.error('Failed to stop scanner:', err);
        }
      }
      scannerRef.current = null;
    }
    setCameraOpen(false);
  }, []);

  const clearLastScan = useCallback(() => {
    lastScanRef.current = null;
  }, []);

  const toggleCamera = useCallback(() => {
    if (cameraOpen) {
      void stopCamera();
    } else {
      setCameraOpen(true);
    }
  }, [cameraOpen, stopCamera]);

  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    try {
      // @ts-ignore - dynamic import resolution in build environment
      const { Html5Qrcode } = await import('html5-qrcode');
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setCameraPermission('granted');
        setCameraIssue(null);
        return true;
      }
      setCameraIssue('No cameras found on this device.');
      return false;
    } catch {
      setCameraPermission('denied');
      setCameraIssue('Camera access denied. Please enable camera permissions in your browser.');
      return false;
    }
  }, []);

  // Check support and hardware on mount
  useEffect(() => {
    const checkSupport = async () => {
      if (!window.isSecureContext && window.location.hostname !== 'localhost') {
        setCameraSupported(false);
        setCameraIssue('Camera only works on HTTPS or localhost.');
        return;
      }

      try {
        // @ts-ignore - dynamic import resolution in build environment
        const { Html5Qrcode } = await import('html5-qrcode');
        const devices = await Html5Qrcode.getCameras();
        if (!devices || devices.length === 0) {
          setCameraSupported(false);
          setCameraIssue('No camera hardware detected on this device.');
        } else {
          setCameraSupported(true);
          setCameraIssue(null);
        }
      } catch (err) {
        setCameraSupported(false);
        const msg = err instanceof Error ? err.message : String(err);
        setCameraIssue(`Could not detect camera hardware: ${msg}`);
      }
    };

    void checkSupport();
  }, []);

  useEffect(() => {
    if (!cameraOpen || !cameraSupported) return;

    let mounted = true;
    let html5QrCode: Html5Qrcode | null = null;
    
    const initScanner = async () => {
      try {
        // @ts-ignore - dynamic import resolution in build environment
        const { Html5Qrcode } = await import('html5-qrcode');
        html5QrCode = new Html5Qrcode(scannerId, { formatsToSupport: formats as unknown as Html5QrcodeSupportedFormats[], verbose: false });
        scannerRef.current = html5QrCode;
        await start();
      } catch (err) {
        console.error('Failed to initialize Html5Qrcode:', err);
        setCameraSupported(false);
        setCameraIssue('Failed to initialize scanner library.');
      }
    };

    const start = async () => {
      try {
        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        if (html5QrCode) {
          await html5QrCode.start(
            { facingMode: 'environment' },
            config,
            async (decodedText: string) => {
              if (!mounted) return;

              // Debounce and process scan
              const now = Date.now();
              if (
                isProcessingRef.current || (lastScanRef.current?.value === decodedText && now - (lastScanRef.current?.time ?? 0) < 2000)
              ) {
                return;
              }

              lastScanRef.current = { value: decodedText, time: now };
              await onScanRef.current(decodedText);
            },
            () => {
               // scan failure, usually just "not found in frame"
            }
          );
        }

        if (mounted) {
          setCameraPermission('granted');
          setCameraIssue(null);
        }
      } catch (err: unknown) {
        if (!mounted) return;
        
        // Only log if it's an unexpected error type
        const errorMessage = err instanceof Error ? err.message : String(err);
        const isHardwareError = errorMessage.includes('NotReadableError') || 
                               errorMessage.includes('Starting video source failed') ||
                               errorMessage.includes('Permission denied') ||
                               errorMessage.includes('NotAllowedError');
        
        if (!isHardwareError) {
          console.error('Scanner start error:', err);
        }
        
        setCameraPermission('denied');
        setCameraIssue(isHardwareError ? 'Camera hardware is busy or unavailable.' : (errorMessage || 'Failed to start camera.'));
        
        // Explicit cleanup on fail
        void stopCamera();
      }
    };

    void initScanner();

    return () => {
      mounted = false;
      void stopCamera();
    };
  }, [cameraOpen, cameraSupported, scannerId, stopCamera, formats]);

  return {
    cameraOpen,
    setCameraOpen,
    cameraSupported,
    cameraPermission,
    cameraIssue,
    stopCamera,
    requestCameraPermission,
    clearLastScan,
    toggleCamera,
    scannerId,
  };
}
