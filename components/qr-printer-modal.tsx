'use client';

import { useState, useRef, useEffect } from 'react';
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
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && qrString) {
      QRCode.toDataURL(qrString, { width: 128, margin: 1 })
        .then((url: string) => setQrDataUrl(url))
        .catch((err: Error) => console.error('Error generating QR', err));
    }
  }, [open, qrString]);

  const handlePrint = () => {
    if (printRef.current) {
      const printContents = printRef.current.innerHTML;
      const originalContents = document.body.innerHTML;

      document.body.innerHTML = printContents;
      window.print();
      document.body.innerHTML = originalContents;
      
      // Reload is required because replacing document.body.innerHTML breaks React bindings
      window.location.reload(); 
    }
  };

  return (
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
          <div 
            ref={printRef} 
            className="border p-4 bg-white text-black flex flex-col items-center justify-center w-[200px] h-[200px]"
          >
            {qrDataUrl && (
              <img src={qrDataUrl} alt={`QR Code for ${bookTitle}`} className="w-24 h-24 mb-2" />
            )}
            <p className="text-xs text-center font-bold break-words w-full px-2 line-clamp-2">{bookTitle}</p>
            <p className="text-[10px] text-gray-500">{qrString}</p>
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
  );
}
