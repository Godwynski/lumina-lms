"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { getCroppedImg } from "@/lib/utils/image";
import { Loader2 } from "lucide-react";

import type { Point, Area } from "react-easy-crop";

interface ImageCropperProps {
  image: string;
  onCropComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

export function ImageCropper({ image, onCropComplete, onCancel }: ImageCropperProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropChange = (crop: Point) => {
    setCrop(crop);
  };

  const onZoomChange = (zoom: number) => {
    setZoom(zoom);
  };

  const onCropCompleteInternal = useCallback((_croppedArea: Area, pixelCrop: Area) => {
    setCroppedAreaPixels(pixelCrop);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    try {
      setIsProcessing(true);
      const croppedBlob = await getCroppedImg(image, croppedAreaPixels);
      onCropComplete(croppedBlob);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={!!image} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-xl border-border/40 p-0 overflow-hidden rounded-[2rem]">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl font-black uppercase tracking-tight">Adjust Profile Photo</DialogTitle>
        </DialogHeader>

        <div className="relative h-80 w-full bg-muted/20 mt-4">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={onCropChange}
            onCropComplete={onCropCompleteInternal}
            onZoomChange={onZoomChange}
            cropShape="round"
            showGrid={false}
          />
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Zoom Level</span>
              <span className="text-[10px] font-bold text-primary">{Math.round(zoom * 100)}%</span>
            </div>
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.1}
              onValueChange={(val) => setZoom(val[0])}
              className="py-4"
            />
          </div>

          <DialogFooter className="flex-row gap-3">
            <Button 
              variant="outline" 
              onClick={onCancel}
              className="flex-1 rounded-2xl font-bold uppercase tracking-widest text-[10px] border-border/40"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={isProcessing}
              className="flex-1 rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20"
            >
              {isProcessing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
