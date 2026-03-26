'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type BarcodeLike = { rawValue?: string };
type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<BarcodeLike[]>;
};

type WindowWithDetector = Window & {
  BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
};

interface UseScannerProps {
  onScan: (value: string) => Promise<void>;
  isProcessing: boolean;
}

export function useScanner({ onScan, isProcessing }: UseScannerProps) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [cameraIssue, setCameraIssue] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);

  const stopCamera = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  }, []);

  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      setCameraIssue('Camera API is unavailable in this browser.');
      return false;
    }

    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      media.getTracks().forEach((track) => track.stop());
      setCameraPermission('granted');
      setCameraIssue(null);
      return true;
    } catch (error: unknown) {
      setCameraPermission('denied');
      setCameraIssue((error as { message?: string })?.message || 'Unable to initialize camera.');
      return false;
    }
  }, []);

  useEffect(() => {
    const detectorCtor = (window as WindowWithDetector).BarcodeDetector;
    const hasMediaDevices = !!navigator.mediaDevices;
    const hasGetUserMedia = typeof navigator.mediaDevices?.getUserMedia === 'function';

    let reason: string | null = null;
    if (!window.isSecureContext) {
      reason = 'Camera only works on HTTPS or localhost.';
    } else if (!hasMediaDevices) {
      reason = 'This browser does not expose mediaDevices.';
    } else if (!hasGetUserMedia) {
      reason = 'This browser does not support getUserMedia.';
    } else if (!detectorCtor) {
      reason = 'QR scanner API (BarcodeDetector) is unavailable in this browser.';
    }

    setCameraSupported(!reason);
    setCameraIssue(reason);
  }, []);

  useEffect(() => {
    if (!cameraOpen || !cameraSupported) return;

    let mounted = true;
    const detectorCtor = (window as WindowWithDetector).BarcodeDetector;
    if (detectorCtor) {
      detectorRef.current = new detectorCtor({ formats: ['qr_code'] });
    }

    const start = async () => {
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });

        if (!mounted) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = media;
        setCameraPermission('granted');
        setCameraIssue(null);
        if (videoRef.current) {
          videoRef.current.srcObject = media;
          await videoRef.current.play();
        }

        const tick = async () => {
          if (!mounted || !videoRef.current || !detectorRef.current || isProcessing) {
             frameRef.current = requestAnimationFrame(tick);
             return;
          }

          try {
            if (videoRef.current.readyState >= 2) {
              const codes = await detectorRef.current.detect(videoRef.current);
              const first = codes.find((code) => !!code.rawValue?.trim());
              if (first?.rawValue) {
                await onScan(first.rawValue);
              }
            }
          } catch {
            // Keep scanning loop alive.
          }

          frameRef.current = requestAnimationFrame(tick);
        };

        frameRef.current = requestAnimationFrame(tick);
      } catch (error: unknown) {
        setCameraPermission('denied');
        setCameraIssue((error as { message?: string })?.message || 'Camera access denied or unavailable.');
        stopCamera();
      }
    };

    void start();

    return () => {
      mounted = false;
      stopCamera();
    };
  }, [cameraOpen, cameraSupported, isProcessing, onScan, stopCamera]);

  return {
    cameraOpen,
    setCameraOpen,
    cameraSupported,
    cameraPermission,
    cameraIssue,
    videoRef,
    stopCamera,
    requestCameraPermission,
  };
}
