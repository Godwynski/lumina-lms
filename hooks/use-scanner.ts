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
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [devices, setDevices] = useState<{ id: string; label: string }[]>([]);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isInitializingRef = useRef(false);
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

  const switchCamera = useCallback(async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    
    if (cameraOpen) {
      // If camera is open, we need to restart it with the new facingMode
      await stopCamera();
      // Give it a small timeout to ensure the hardware is released
      setTimeout(() => setCameraOpen(true), 200);
    }
  }, [facingMode, cameraOpen, stopCamera]);

  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const cameras = await Html5Qrcode.getCameras();
      setDevices(cameras);
      if (cameras && cameras.length > 0) {
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

  useEffect(() => {
    const checkSupport = async () => {
      if (!window.isSecureContext && window.location.hostname !== 'localhost') {
        setCameraSupported(false);
        setCameraIssue('Camera only works on HTTPS or localhost.');
        return;
      }

      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        const cameras = await Html5Qrcode.getCameras();
        setDevices(cameras);
        if (!cameras || cameras.length === 0) {
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
      if (isInitializingRef.current || scannerRef.current?.isScanning) return;
      isInitializingRef.current = true;

      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        
        if (scannerRef.current) {
          try {
            if (scannerRef.current.isScanning) await scannerRef.current.stop();
          } catch {}
          scannerRef.current = null;
        }

        html5QrCode = new Html5Qrcode(scannerId, { 
          formatsToSupport: formats as unknown as Html5QrcodeSupportedFormats[], 
          verbose: false 
        });
        scannerRef.current = html5QrCode;
        await start();
      } catch (err) {
        console.error('Failed to initialize Html5Qrcode:', err);
        setCameraSupported(false);
        setCameraIssue('Failed to initialize scanner library.');
      } finally {
        isInitializingRef.current = false;
      }
    };

    const start = async () => {
      try {
        // Detect device environment
        
        const config = {
          fps: 15, // Slightly higher FPS for snappier response
          qrbox: (viewWidth: number, viewHeight: number) => {
            const min = Math.min(viewWidth, viewHeight);
            const boxSize = Math.floor(min * 0.7); // 70% of viewport
            return { width: boxSize, height: boxSize };
          },
          aspectRatio: 1.0,
        };

        if (html5QrCode) {
          await html5QrCode.start(
            { facingMode: facingMode },
            config,
            async (decodedText: string) => {
              if (!mounted) return;

              const now = Date.now();
              if (
                isProcessingRef.current || (lastScanRef.current?.value === decodedText && now - (lastScanRef.current?.time ?? 0) < 2000)
              ) {
                return;
              }

              lastScanRef.current = { value: decodedText, time: now };
              // We stop scanning internally if requested, but use-scanner usually stays open until manually closed
              await onScanRef.current(decodedText);
            },
            () => {}
          );
        }

        if (mounted) {
          setCameraPermission('granted');
          setCameraIssue(null);
        }
      } catch (err: unknown) {
        if (!mounted) return;
        
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
        
        if (!isHardwareError) {
           void stopCamera();
        }
      }
    };

    void initScanner();

    return () => {
      mounted = false;
      void stopCamera();
    };
  }, [cameraOpen, cameraSupported, scannerId, stopCamera, formats, facingMode]);

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
    switchCamera,
    facingMode,
    hasMultipleCameras: devices.length > 1,
    scannerId,
  };
}
