'use client';

import { Camera, QrCode, ScanLine, RefreshCcw, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useScanner } from '@/hooks/use-scanner';
import { useState, useRef, useEffect } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1">
                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                        <ScanLine className="h-4 w-4 text-primary" />
                        {title}
                    </h3>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-tight font-medium">{description}</p>
                </div>
                
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground">
                                <HelpCircle className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-[200px] p-4 bg-card border border-border/10 shadow-xl">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest mb-2">Scanning Tips</h4>
                            <ul className="text-[10px] space-y-1.5 text-muted-foreground list-disc pl-3">
                                <li>Ensure good lighting.</li>
                                <li>Keep the code steady.</li>
                                <li>Toggle camera if focus fails.</li>
                            </ul>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            <div className="grid gap-8 items-center lg:grid-cols-[1fr_1.2fr]">
                <div className="relative aspect-square max-w-[280px] mx-auto w-full overflow-hidden rounded-2xl border border-border/10 bg-muted/20 shadow-inner">
                    <div 
                        id={scannerId} 
                        className="h-full w-full [&>video]:object-cover [&>video]:h-full [&>video]:w-full" 
                    />
                    
                    {/* Minimalist Overlay */}
                    <div className="absolute inset-0 pointer-events-none border-[12px] border-background/20" />
                    
                    {isProcessing && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}
                    
                    {!cameraOpen && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm transition-all duration-200">
                            <QrCode className="h-10 w-10 text-muted-foreground/40 mb-4" />
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-9 rounded-xl border-primary/20 text-primary hover:bg-primary/5 font-bold text-[10px] uppercase tracking-wider"
                                onClick={() => setCameraOpen(true)}
                                disabled={!cameraSupported}
                            >
                                <Camera className="mr-2 h-3.5 w-3.5" />
                                Launch Scanner
                            </Button>
                        </div>
                    )}

                    {cameraOpen && (
                         <div className="absolute bottom-4 inset-x-4 flex justify-between items-center">
                            <Button 
                                variant="secondary" 
                                size="icon" 
                                className={`h-9 w-9 rounded-xl backdrop-blur-md bg-background/60 border border-white/10 ${!hasMultipleCameras ? 'invisible' : ''}`}
                                onClick={switchCamera}
                            >
                                <RefreshCcw className="h-4 w-4" />
                            </Button>

                            <Button 
                                variant="destructive" 
                                className="h-9 rounded-xl px-4 backdrop-blur-md bg-destructive/90 text-[10px] font-bold uppercase tracking-wider"
                                onClick={() => setCameraOpen(false)}
                            >
                                Stop
                            </Button>
                        </div>
                    )}
                    
                    {cameraIssue && !cameraOpen && (
                         <div className="absolute top-4 inset-x-4">
                            <div className="bg-destructive/10 border border-destructive/20 backdrop-blur-md rounded-xl p-3 text-[10px] text-destructive font-medium">
                                {cameraIssue}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-4">
                    <div className="space-y-2">
                        <label className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground ml-1">
                            Direct Entry
                        </label>
                        <div className="flex gap-2">
                            <Input
                                ref={manualInputRef}
                                value={manualValue}
                                onChange={(e) => setManualValue(e.target.value.toUpperCase())}
                                onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                                placeholder={placeholder}
                                className="h-11 rounded-xl bg-muted/30 border-border/20 focus:border-primary/40 focus:ring-0 uppercase text-xs"
                            />
                            <Button 
                                onClick={handleManualSubmit}
                                disabled={isProcessing || !manualValue.trim()}
                                className="h-11 rounded-xl px-6 font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-primary/10"
                            >
                                {isProcessing ? '...' : actionLabel}
                            </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground ml-1 font-medium opacity-60">
                            Enter the identifier manually if scan fails.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
