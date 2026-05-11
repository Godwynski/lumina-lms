"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Camera, StopCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose?: () => void;
  className?: string;
  autoStart?: boolean;
}

export function QRScanner({ onScan, onClose, className, autoStart = true }: QRScannerProps) {
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const regionId = "qr-reader";

  const isStoppingRef = useRef(false);

  const stopScanner = useCallback(async () => {
    if (isStoppingRef.current) return;
    if (scannerRef.current && scannerRef.current.isScanning) {
      isStoppingRef.current = true;
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
        setIsScannerActive(false);
      } catch (err) {
        // If it's already stopped or in a state where it can't stop, we can safely ignore the transition error
        if (err instanceof Error && !err.message.includes("Cannot transition")) {
          console.error("Scanner stop error:", err);
        }
      } finally {
        isStoppingRef.current = false;
      }
    }
  }, []);

  const isStartingRef = useRef(false);

  const isMounted = useRef(true);

  const startScanner = useCallback(async () => {
    if (!isMounted.current || isStartingRef.current || (scannerRef.current && scannerRef.current.isScanning)) return;
    
    isStartingRef.current = true;
    try {
      // Ensure any existing instance is cleaned up first
      if (scannerRef.current) {
        try {
          await stopScanner();
        } catch { /* ignore cleanup errors */ }
      }

      if (!isMounted.current) return;

      const html5QrCode = new Html5Qrcode(regionId);
      scannerRef.current = html5QrCode;
      
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          onScan(decodedText);
          // Auto-stop after successful scan to prevent multiple triggers
          void stopScanner();
        },
        () => {
          // Failure callback, ignore to keep UI clean
        }
      );
      
      if (isMounted.current) {
        setIsScannerActive(true);
        setError(null);
      } else {
        // If unmounted during start, stop it immediately
        void stopScanner();
      }
    } catch (err) {
      if (isMounted.current) {
        console.error("Scanner start error:", err);
        setError("Failed to access camera. Please check permissions.");
      }
    } finally {
      isStartingRef.current = false;
    }
  }, [onScan, stopScanner]);

  useEffect(() => {
    isMounted.current = true;
    if (autoStart) {
      void startScanner();
    }
    return () => {
      isMounted.current = false;
      void stopScanner();
    };
  }, [autoStart, startScanner, stopScanner]);

  return (
    <div className={cn("relative flex flex-col items-center justify-center overflow-hidden rounded-2xl bg-black/90", className)}>
      <div id={regionId} className="w-full h-full" />
      
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-background/95 backdrop-blur-sm">
          <p className="text-sm font-bold text-destructive mb-4">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void startScanner()} className="h-8">
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}

      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 px-4">
        {isScannerActive ? (
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={() => {
              void stopScanner();
              onClose?.();
            }} 
            className="h-8 bg-red-600/20 hover:bg-red-600/40 text-red-500 border-red-500/20 backdrop-blur-md"
          >
            <StopCircle className="mr-2 h-3.5 w-3.5" />
            Stop Scanner
          </Button>
        ) : (
          !error && (
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => void startScanner()} 
              className="h-8 bg-white/10 hover:bg-white/20 text-white border-white/10 backdrop-blur-md"
            >
              <Camera className="mr-2 h-3.5 w-3.5" />
              Open Camera
            </Button>
          )
        )}
      </div>
    </div>
  );
}
