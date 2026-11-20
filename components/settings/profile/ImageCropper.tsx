"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { 
  Dialog, 
  DialogContent,
  DialogDescription,
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { getCroppedImg } from "@/lib/image-utils";
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
  const [mediaSize, setMediaSize] = useState({ width: 0, height: 0 });
  const [cropSize, setCropSize] = useState({ width: 0, height: 0 });
  const [cropError, setCropError] = useState("");
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

  const movePhoto = (dx: number, dy: number) => {
    const limitX = Math.max(0, (mediaSize.width * zoom - cropSize.width) / 2);
    const limitY = Math.max(0, (mediaSize.height * zoom - cropSize.height) / 2);
    setCrop(({ x, y }) => ({
      x: Math.max(-limitX, Math.min(limitX, x + dx)),
      y: Math.max(-limitY, Math.min(limitY, y + dy)),
    }));
  };

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    try {
      setCropError("");
      setIsProcessing(true);
      const croppedBlob = await getCroppedImg(image, croppedAreaPixels);
      onCropComplete(croppedBlob);
    } catch (e) {
      console.error(e);
      setCropError("The photo could not be cropped. Try again or choose another image.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={!!image} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-xl border-border/40 p-0 max-h-[90dvh] overflow-y-auto rounded-[2rem]">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl font-black uppercase tracking-tight">Adjust Profile Photo</DialogTitle>
          <DialogDescription>Use the direction buttons to position your photo, then adjust the zoom.</DialogDescription>
        </DialogHeader>

        <div className="relative h-[min(35dvh,20rem)] w-full bg-muted/20 mt-4">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={onCropChange}
            onCropComplete={onCropCompleteInternal}
            onZoomChange={onZoomChange}
            onMediaLoaded={setMediaSize}
            onCropSizeChange={setCropSize}
            cropperProps={{ "aria-label": "Photo position. Use arrow keys to move the photo." }}
            cropShape="round"
            showGrid={false}
          />
        </div>

        <div className="p-6 space-y-6">
          <div role="group" aria-label="Move photo" className="flex flex-wrap gap-2">
            {([["Left", -10, 0], ["Right", 10, 0], ["Up", 0, -10], ["Down", 0, 10]] as const).map(([label, dx, dy]) => (
              <Button key={label} type="button" variant="outline" size="sm" onClick={() => movePhoto(dx, dy)}>{label}</Button>
            ))}
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Zoom Level</span>
              <span className="text-[11px] font-bold text-primary">{Math.round(zoom * 100)}%</span>
            </div>
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.1}
              onValueChange={(val) => setZoom(val[0])}
              aria-label="Zoom level"
              className="py-4"
            />
          </div>

          {cropError && <p role="alert" className="text-sm text-destructive">{cropError}</p>}
          <DialogFooter className="flex-row gap-3">
            <Button 
              variant="outline" 
              onClick={onCancel}
              className="flex-1 rounded-2xl font-bold uppercase tracking-widest text-[11px] border-border/40"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={isProcessing}
              className="flex-1 rounded-2xl font-bold uppercase tracking-widest text-[11px] shadow-lg shadow-primary/20"
            >
              {isProcessing ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> Saving</>
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
