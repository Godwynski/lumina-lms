'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import QRCode from 'qrcode';

interface QRPrinterModalProps {
  qrString: string;
  bookTitle: string;
}

export function QRPrinterModal({ qrString, bookTitle }: QRPrinterModalProps) {
  const [open, setOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (open && qrString) {
      QRCode.toDataURL(qrString, { width: 128, margin: 1 })
        .then((url: string) => setQrDataUrl(url))
        .catch((err: Error) => console.error('Error generating QR', err));
    }
  }, [open, qrString]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Printer className="mr-2 h-4 w-4" />
            Print QR
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Print QR Label</DialogTitle>
            <DialogDescription>
              Configure and print a QR code label for this book.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center space-y-4 py-4">
            <div className="border p-4 bg-white text-black flex flex-col items-center justify-center w-[200px] h-[200px] rounded-lg">
              {qrDataUrl && (
                <img src={qrDataUrl} alt={`QR Code for ${bookTitle}`} className="w-24 h-24 mb-2" />
              )}
              <p className="text-xs text-center font-bold break-words w-full px-2 line-clamp-2">{bookTitle}</p>
              <p className="text-xs text-neutral-600">{qrString}</p>
            </div>

            <p className="text-sm text-muted-foreground text-center">
              Load adhesive sticker paper into your printer before continuing.
            </p>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handlePrint}>Print Label</Button>
          </div>
        </DialogContent>
      </Dialog>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          data-qr-print-sheet="true"
          aria-hidden="true"
          className="hidden print:flex print:fixed print:inset-0 print:items-center print:justify-center print:bg-white"
        >
          <style>{`@media print { body > *:not([data-qr-print-sheet="true"]) { display: none !important; } }`}</style>
          <div className="border border-black p-4 bg-white text-black flex flex-col items-center justify-center w-[200px] h-[200px]">
            {qrDataUrl && (
              <img src={qrDataUrl} alt="" className="w-24 h-24 mb-2" />
            )}
            <p className="text-xs text-center font-bold break-words w-full px-2 line-clamp-2">{bookTitle}</p>
            <p className="text-xs text-neutral-700">{qrString}</p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
