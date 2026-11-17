'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import QRCode from 'qrcode';

interface QRLabel {
  qrString: string;
  accessionNumber?: string | null;
}

interface QRPrinterModalProps {
  bookTitle: string;
  /** One label. */
  qrString?: string;
  accessionNumber?: string | null;
  /** A sheet of labels, one per copy (P5-INV-013). */
  labels?: QRLabel[];
  triggerLabel?: string;
}

export function QRPrinterModal({ qrString, accessionNumber, labels, bookTitle, triggerLabel = 'Print QR' }: QRPrinterModalProps) {
  const [open, setOpen] = useState(false);
  const [dataUrls, setDataUrls] = useState<Record<string, string>>({});
  const items: QRLabel[] = labels ?? (qrString ? [{ qrString, accessionNumber }] : []);
  const key = items.map((l) => l.qrString).join('|');

  useEffect(() => {
    if (!open || !key) return;
    const codes = key.split('|');
    Promise.all(codes.map((code) => QRCode.toDataURL(code, { width: 128, margin: 1 })))
      .then((urls: string[]) => setDataUrls(Object.fromEntries(codes.map((code, i) => [code, urls[i]]))))
      .catch((err: Error) => console.error('Error generating QR', err));
  }, [open, key]);

  const label = (item: QRLabel, bordered: string) => (
    <div key={item.qrString} className={`${bordered} p-4 bg-white text-black flex flex-col items-center justify-center w-[200px] h-[200px] break-inside-avoid`}>
      {dataUrls[item.qrString] && (
        <img src={dataUrls[item.qrString]} alt={bordered === 'border rounded-lg' ? `QR Code for ${bookTitle}${items.length > 1 ? ` (${item.qrString})` : ''}` : ''} className="w-24 h-24 mb-2" />
      )}
      <p className="text-xs text-center font-bold break-words w-full px-2 line-clamp-2">{bookTitle}</p>
      <p className="text-xs text-neutral-700">{item.qrString}</p>
      {item.accessionNumber && <p className="text-xs text-neutral-700">{item.accessionNumber}</p>}
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={items.length === 0}>
            <Printer className="mr-2 h-4 w-4" />
            {triggerLabel}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{items.length > 1 ? `Print ${items.length} QR Labels` : 'Print QR Label'}</DialogTitle>
            <DialogDescription>
              {items.length > 1 ? 'Print one QR label for each copy of this book.' : 'Configure and print a QR code label for this book.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center space-y-4 py-4">
            <div className="flex flex-wrap justify-center gap-3">{items.map((item) => label(item, 'border rounded-lg'))}</div>
            <p className="text-sm text-muted-foreground text-center">
              Load adhesive sticker paper into your printer before continuing.
            </p>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => window.print()}>{items.length > 1 ? 'Print Labels' : 'Print Label'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          data-qr-print-sheet="true"
          aria-hidden="true"
          className="hidden print:flex print:flex-wrap print:content-start print:gap-2 print:bg-white"
        >
          <style>{`@media print { body > *:not([data-qr-print-sheet="true"]) { display: none !important; } }`}</style>
          {items.map((item) => label(item, 'border border-black'))}
        </div>,
        document.body
      )}
    </>
  );
}
