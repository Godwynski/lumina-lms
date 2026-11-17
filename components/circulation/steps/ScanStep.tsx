'use client';

import { Camera, QrCode, ScanLine, RefreshCcw, HelpCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useScanner } from '@/hooks/use-scanner';
import { useId, useState } from 'react';
import { Label, Field } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ScanStepProps {
  title: string;
  description: string;
  label?: string;
  placeholder: string;
  onScan: (value: string, isManual?: boolean) => Promise<boolean>;
  isProcessing: boolean;
  actionLabel: string;
}

export function ScanStep({
  title,
  description,
  label,
  placeholder,
  onScan,
  isProcessing,
  actionLabel
}: ScanStepProps) {
  const [manualValue, setManualValue] = useState('');
  const entryHintId = useId();
  const fieldLabel = label ?? placeholder;

  const {
    cameraOpen,
    startScanner,
    stopCamera,
    isInitializing,
    cameraIssue,
    scannerId,
    switchCamera,
    hasMultipleCameras,
  } = useScanner({
    onScan: async (val) => {
      if (await onScan(val, false)) setManualValue('');
    },
    isProcessing,
    scannerId: 'circulation-scanner'
  });

  const handleManualSubmit = async () => {
    if (!manualValue.trim() || isProcessing) return;
    const success = await onScan(manualValue.trim(), true);
    if (success) {
      setManualValue('');
    }
  };

  const showCameraPreview = cameraOpen || isInitializing;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-primary" />
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Scanning tips" className="h-9 w-9 rounded-lg text-muted-foreground shrink-0">
                <HelpCircle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs p-3 bg-card border border-border">
              <p className="text-xs font-semibold mb-1.5">Scanning tips</p>
              <ul className="text-xs space-y-1 text-muted-foreground list-disc pl-4">
                <li>Use a handheld scanner directly into the focused input.</li>
                <li>Ensure good lighting and hold QR codes steady for the camera.</li>
                <li>Toggle the camera scanner below if manual entry is inconvenient.</li>
              </ul>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Primary handheld-scanner / manual input */}
      <div className="rounded-xl border border-border/60 bg-background p-4 sm:p-5 space-y-3">
        <Field className="space-y-2">
          <Label htmlFor="circulation-code" className="text-sm font-medium text-foreground">
            {fieldLabel}
          </Label>
          <form onSubmit={(event) => { event.preventDefault(); void handleManualSubmit(); }} className="flex flex-col sm:flex-row gap-2">
            <Input
              aria-describedby={entryHintId}
              id="circulation-code"
              autoFocus
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value.toUpperCase())}
              placeholder={placeholder}
              className="min-w-0 flex-1 h-10 rounded-lg bg-background font-mono text-sm uppercase placeholder:normal-case placeholder:font-sans"
            />
            <Button
              type="submit"
              disabled={isProcessing || !manualValue.trim()}
              className="h-10 rounded-lg px-6 text-sm font-semibold disabled:opacity-100 disabled:bg-muted disabled:text-muted-foreground disabled:border disabled:border-border"
            >
              {isProcessing ? 'Verifying…' : actionLabel}
            </Button>
          </form>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p id={entryHintId} className="text-xs text-muted-foreground">
              Scan with a barcode reader or type the identifier and press Enter.
            </p>
            {isProcessing && !showCameraPreview && (
              <span role="status" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Verifying entry…</span>
              </span>
            )}
          </div>
        </Field>
      </div>

      {/* Secondary collapsible camera scanner */}
      <div className="space-y-3">
        {!showCameraPreview && (
          <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground">
                <QrCode className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Camera QR scanner</p>
                <p className="text-xs text-muted-foreground">Optional fallback when a handheld scanner is unavailable.</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-lg px-3.5 text-xs font-semibold shrink-0"
              onClick={() => startScanner()}
              disabled={isInitializing}
            >
              {cameraIssue ? (
                <>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Retry camera
                </>
              ) : (
                <>
                  <Camera className="mr-1.5 h-3.5 w-3.5" />
                  Start camera
                </>
              )}
            </Button>
          </div>
        )}

        {cameraIssue && !showCameraPreview && (
          <div role="alert" className="status-danger border rounded-xl p-3 text-xs font-medium">
            {cameraIssue}
          </div>
        )}

        <div
          className={
            showCameraPreview
              ? 'relative aspect-square max-w-[280px] mx-auto w-full overflow-hidden rounded-2xl border border-border/60 bg-muted/20'
              : 'hidden'
          }
        >
          <div
            id={scannerId}
            className="h-full w-full [&>video]:object-cover [&>video]:h-full [&>video]:w-full"
          />

          <div className="absolute inset-0 pointer-events-none border-[12px] border-background/20" />

          {(isProcessing || isInitializing) && (
            <div role="status" className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/70 backdrop-blur-sm">
              <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
              {isProcessing && !isInitializing && <span className="sr-only">Verifying entry…</span>}
              {isInitializing && <span className="text-xs font-semibold text-primary">Initializing camera…</span>}
            </div>
          )}

          {cameraOpen && (
            <div className="absolute bottom-4 inset-x-4 flex justify-between items-center z-20">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className={`h-9 w-9 rounded-lg backdrop-blur-md bg-background/80 border border-border ${!hasMultipleCameras ? 'invisible' : ''}`}
                onClick={switchCamera}
                aria-label="Switch camera"
                title="Switch Camera"
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-9 rounded-lg px-4 text-xs font-semibold"
                onClick={() => stopCamera()}
              >
                Stop camera
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
