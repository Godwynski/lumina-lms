'use client';

import { Camera, QrCode, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useScanner } from '@/hooks/use-scanner';
import { useState, useRef, useEffect } from 'react';

interface ScanStepProps {
  title: string;
  description: string;
  placeholder: string;
  onScan: (value: string) => Promise<void>;
  isProcessing: boolean;
  actionLabel: string;
}

export function ScanStep({ 
  title, 
  description, 
  placeholder, 
  onScan, 
  isProcessing,
  actionLabel
}: ScanStepProps) {
  const [manualValue, setManualValue] = useState('');
  const manualInputRef = useRef<HTMLInputElement>(null);
  
  const {
    cameraOpen,
    setCameraOpen,
    cameraSupported,
    cameraIssue,
    scannerId,
  } = useScanner({
    onScan: async (val) => {
      await onScan(val);
    },
    isProcessing,
    scannerId: 'circulation-scanner'
  });

  const handleManualSubmit = async () => {
    if (!manualValue.trim() || isProcessing) return;
    await onScan(manualValue.trim());
    setManualValue('');
  };

  useEffect(() => {
    manualInputRef.current?.focus();
  }, []);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-primary" />
          {title}
        </h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-border bg-black shadow-inner">
            <div 
              id={scannerId} 
              className="h-full w-full [&>video]:object-cover [&>video]:h-full [&>video]:w-full" 
            />
            
            {/* Scanner Overlay UI */}
            <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
                <div className="h-full w-full border-2 border-primary/50 rounded-lg relative">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary" />
                </div>
            </div>

            {!cameraOpen && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm transition-all duration-300">
                <QrCode className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm font-medium">Scanner is idle</p>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="mt-4 h-8 rounded-full"
                  onClick={() => setCameraOpen(true)}
                  disabled={!cameraSupported}
                >
                  <Camera className="mr-2 h-3.5 w-3.5" />
                  Start Scanner
                </Button>
              </div>
            )}

            {cameraOpen && (
                 <div className="absolute bottom-4 right-4 animate-in fade-in zoom-in">
                    <Button 
                        variant="destructive" 
                        size="sm" 
                        className="h-8 rounded-full shadow-lg"
                        onClick={() => setCameraOpen(false)}
                    >
                        Stop
                    </Button>
                </div>
            )}
            
            {cameraIssue && !cameraOpen && (
                 <div className="absolute top-4 inset-x-4">
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-2 text-[10px] text-destructive flex items-center gap-2">
                        <span>{cameraIssue}</span>
                    </div>
                </div>
            )}
          </div>
        </div>

        <div className="flex flex-col justify-center space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">
              Manual Input
            </label>
            <div className="flex gap-2">
              <Input
                ref={manualInputRef}
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                placeholder={placeholder}
                className="h-10 rounded-xl bg-muted/40 border-border focus:ring-primary/20"
              />
              <Button 
                onClick={handleManualSubmit}
                disabled={isProcessing || !manualValue.trim()}
                className="h-10 rounded-xl px-4"
              >
                {isProcessing ? '...' : actionLabel}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground px-1 italic">
              Press Enter or click the button to process manual entries.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card/50 p-4">
            <h4 className="text-xs font-semibold mb-2">Tips for success:</h4>
            <ul className="text-[11px] space-y-1.5 text-muted-foreground list-disc pl-4">
              <li>Ensure good lighting and avoid reflections on screens.</li>
              <li>Keep the card/QR code steady within the frame.</li>
              <li>Toggle the camera if the focus seems stuck.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
