'use client';

import { Camera, QrCode, ScanLine, RefreshCcw } from 'lucide-react';
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
        switchCamera,
        hasMultipleCameras,
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

            <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-3">
                    <div className="relative aspect-square overflow-hidden rounded-3xl border border-border bg-black shadow-2xl">
                        <div 
                            id={scannerId} 
                            className="h-full w-full [&>video]:object-cover [&>video]:h-full [&>video]:w-full" 
                        />
                        
                        {/* Minimalism Scanning Brackets */}
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute top-8 left-8 w-12 h-12 border-t-2 border-l-2 border-primary/60 rounded-tl-xl" />
                            <div className="absolute top-8 right-8 w-12 h-12 border-t-2 border-r-2 border-primary/60 rounded-tr-xl" />
                            <div className="absolute bottom-8 left-8 w-12 h-12 border-b-2 border-l-2 border-primary/60 rounded-bl-xl" />
                            <div className="absolute bottom-8 right-8 w-12 h-12 border-b-2 border-r-2 border-primary/60 rounded-br-xl" />
                        </div>

                        {/* Scanner Scanning Line Animation */}
                        {cameraOpen && !isProcessing && (
                             <div className="absolute top-0 inset-x-8 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent animate-scan shadow-[0_0_15px_rgba(var(--primary),0.5)]" />
                        )}

                        {/* Processing Shimmer */}
                        {isProcessing && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/40 backdrop-blur-[2px] animate-pulse">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                                    <span className="text-xs font-bold tracking-widest uppercase text-primary">Identifying...</span>
                                </div>
                            </div>
                        )}
                        
                        {!cameraOpen && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/95 backdrop-blur-md transition-all duration-300">
                                <div className="p-6 rounded-full bg-muted/20 mb-4">
                                    <QrCode className="h-12 w-12 text-muted-foreground" />
                                </div>
                                <p className="text-sm font-semibold tracking-tight">Scanner Hardware Ready</p>
                                <Button 
                                    variant="default" 
                                    size="lg" 
                                    className="mt-6 h-12 rounded-2xl px-8 shadow-xl shadow-primary/20"
                                    onClick={() => setCameraOpen(true)}
                                    disabled={!cameraSupported}
                                >
                                    <Camera className="mr-2 h-4 w-4" />
                                    Launch Scanner
                                </Button>
                            </div>
                        )}

                        {cameraOpen && (
                             <div className="absolute bottom-6 inset-x-6 flex justify-between items-center animate-in fade-in slide-in-from-bottom-4">
                                <Button 
                                    variant="secondary" 
                                    size="icon" 
                                    className={`h-12 w-12 rounded-2xl backdrop-blur-xl bg-background/40 border-white/10 shadow-2xl ${!hasMultipleCameras ? 'invisible' : ''}`}
                                    onClick={switchCamera}
                                    title="Switch Camera"
                                >
                                    <RefreshCcw className="h-5 w-5" />
                                </Button>

                                <Button 
                                    variant="destructive" 
                                    className="h-12 rounded-2xl px-6 backdrop-blur-xl bg-destructive shadow-2xl border-none font-bold"
                                    onClick={() => setCameraOpen(false)}
                                >
                                    Stop
                                </Button>
                            </div>
                        )}
                        
                        {cameraIssue && !cameraOpen && (
                             <div className="absolute top-6 inset-x-6">
                                <div className="bg-destructive/10 border border-destructive/20 backdrop-blur-xl rounded-2xl p-4 text-[11px] text-destructive flex items-center gap-3">
                                    <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                                    <span className="font-medium">{cameraIssue}</span>
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
