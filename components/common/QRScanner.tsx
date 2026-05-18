"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Camera, StopCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose?: () => void;
  className?: string;
  autoStart?: boolean;
  stopOnScan?: boolean;
}

export function QRScanner({ 
  onScan, 
  onClose, 
  className, 
  autoStart = true,
  stopOnScan = true 
}: QRScannerProps) {
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Visual-only state for cooldown overlay ---
  const [showCooldown, setShowCooldown] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStoppingRef = useRef(false);
  const isStartingRef = useRef(false);
  const isMountedRef = useRef(true);

  // --- Refs for values read inside the html5-qrcode callback ---
  // These MUST be refs (not state) to avoid stale closures.
  const isCooldownRef = useRef(false);
  const lastScannedRef = useRef<{ value: string; time: number } | null>(null);
  const onScanRef = useRef(onScan);
  const stopOnScanRef = useRef(stopOnScan);

  // Keep refs in sync with latest prop values
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);
  useEffect(() => { stopOnScanRef.current = stopOnScan; }, [stopOnScan]);

  const regionId = "qr-reader";

  const stopScanner = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    try {
      // 1. Stop all media tracks FIRST to prevent the RenderedCameraImpl
      //    onabort() error that fires when the video surface is removed
      //    while a MediaStream is still pushing frames to it.
      const container = document.getElementById(regionId);
      const videoElem = container?.querySelector("video");
      if (videoElem) {
        // Detach abort handler before we touch anything
        videoElem.onabort = null;
        if (videoElem.srcObject instanceof MediaStream) {
          videoElem.srcObject.getTracks().forEach(track => track.stop());
          videoElem.srcObject = null;
        }
      }

      // 2. Now safely stop and clear the scanner instance
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
        } catch (stopErr) {
          // Suppress "Cannot transition" and abort errors during teardown
          if (stopErr instanceof Error && !stopErr.message.includes("Cannot transition") && !stopErr.message.includes("onabort")) {
            console.warn("Scanner stop warning:", stopErr);
          }
        }
        try {
          await scannerRef.current.clear();
        } catch {
          // clear() can throw if the video surface was already removed
        }
        scannerRef.current = null;
      }

      setIsScannerActive(false);
    } catch (err) {
      if (err instanceof Error && !err.message.includes("Cannot transition") && !err.message.includes("onabort")) {
        console.warn("Scanner cleanup warning:", err);
      }
    } finally {
      isStoppingRef.current = false;
    }
  }, []);

  // startScanner has NO dependencies on onScan or stopOnScan (uses refs),
  // so its identity is stable and won't cause useEffect cleanup loops.
  const startScanner = useCallback(async () => {
    if (!isMountedRef.current || isStartingRef.current || (scannerRef.current && scannerRef.current.isScanning)) return;
    
    isStartingRef.current = true;
    try {
      // Ensure any existing instance is cleaned up first
      if (scannerRef.current) {
        try {
          await stopScanner();
        } catch { /* ignore cleanup errors */ }
      }

      if (!isMountedRef.current) return;

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
          // --- ALL reads here use refs, never stale state ---
          const now = Date.now();
          const cleanData = decodedText.trim();

          if (!stopOnScanRef.current) {
            // Continuous mode: enforce cooldown via ref
            if (isCooldownRef.current) return;

            if (lastScannedRef.current?.value === cleanData && now - lastScannedRef.current.time < 3000) {
              return;
            }

            lastScannedRef.current = { value: cleanData, time: now };

            // Activate cooldown synchronously via ref (blocks next frame)
            isCooldownRef.current = true;
            setShowCooldown(true);

            setTimeout(() => {
              isCooldownRef.current = false;
              setShowCooldown(false);
            }, 3000);
          }

          // Use ref to call the latest onScan without capturing it in closure
          onScanRef.current(decodedText);
          
          if (stopOnScanRef.current) {
            void stopScanner();
          }
        },
        () => {
          // Failure callback, ignore to keep UI clean
        }
      );
      
      if (isMountedRef.current) {
        setIsScannerActive(true);
        setError(null);
      } else {
        void stopScanner();
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error("Scanner start error:", err);
        
        const errStr = String(err);
        const errMessage = (err && typeof err === "object" && "message" in err) ? String((err as Record<string, unknown>).message) : "";
        const errName = (err && typeof err === "object" && "name" in err) ? String((err as Record<string, unknown>).name) : "";
        const fullErrorText = `${errStr} ${errMessage} ${errName}`.toLowerCase();
        
        let errorMsg = "Failed to access camera. Please verify device connection and permissions.";
        
        if (
          fullErrorText.includes("notreadableerror") || 
          fullErrorText.includes("readable") || 
          fullErrorText.includes("could not start video source") || 
          fullErrorText.includes("video source") || 
          fullErrorText.includes("concurrent")
        ) {
          errorMsg = "Camera is currently in use by another application, tab, or is blocked by system locks.";
        } else if (
          fullErrorText.includes("notallowederror") || 
          fullErrorText.includes("permission") || 
          fullErrorText.includes("denied")
        ) {
          errorMsg = "Camera permission denied. Please allow camera access in your browser settings.";
        } else if (
          fullErrorText.includes("notfounderror") || 
          fullErrorText.includes("devicesnotfound") || 
          fullErrorText.includes("no camera") || 
          fullErrorText.includes("not found")
        ) {
          errorMsg = "No camera device detected. Please ensure your camera is connected and active.";
        } else if (
          fullErrorText.includes("overconstrainederror") || 
          fullErrorText.includes("constraint")
        ) {
          errorMsg = "Could not find a camera matching the requested constraints (e.g. environment facing).";
        } else if (
          fullErrorText.includes("securityerror") || 
          fullErrorText.includes("secure context")
        ) {
          errorMsg = "Camera access is blocked by security policies. Ensure this site uses HTTPS.";
        }

        setError(errorMsg);
        toast.error(errorMsg);
      }
    } finally {
      isStartingRef.current = false;
    }
  }, [stopScanner]); // Only depends on stopScanner (which is stable)

  useEffect(() => {
    isMountedRef.current = true;
    if (autoStart) {
      void startScanner();
    }
    return () => {
      isMountedRef.current = false;
      void stopScanner();
    };
  }, [autoStart, startScanner, stopScanner]);

  return (
    <div className={cn("relative flex flex-col items-center justify-center overflow-hidden rounded-2xl bg-black/90", className)}>
      <div id={regionId} className="w-full h-full" />
      
      {showCooldown && !stopOnScan && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/10 backdrop-blur-[0.5px] transition-all duration-300">
          <div className="bg-background/80 backdrop-blur-md px-6 py-3 rounded-2xl border border-primary/20 shadow-2xl flex flex-col items-center gap-2 animate-in zoom-in fade-in duration-300">
            <div className="h-1 w-24 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary animate-cooldown-progress" />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary">Cooldown Active</span>
          </div>
        </div>
      )}

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
