import { z } from 'zod';

const manilaDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function libraryDate(date = new Date()) {
  return manilaDate.format(date);
}

const copyDateSchema = z.iso.date()
  .refine(date => !date.startsWith('0000-'), 'Enter a valid date.')
  .refine(date => date <= libraryDate(), 'Date cannot be in the future.');
export const copyMoneySchema = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Enter an amount with up to two decimal places.');

export const copyAcquisitionSchema = z.object({
  method: z.enum(['PURCHASED', 'DONATED']).nullable(),
  acquiredOn: copyDateSchema.nullable(),
  purchasePrice: copyMoneySchema.nullable(),
}).refine(value => value.purchasePrice === null || value.method === 'PURCHASED', {
  path: ['purchasePrice'], message: 'Price per copy only applies to bought copies.',
});

export type CopyAcquisition = z.infer<typeof copyAcquisitionSchema>;

export function hasCopyAcquisition(acquisition?: CopyAcquisition | null): acquisition is CopyAcquisition {
  return Boolean(acquisition && (acquisition.method || acquisition.acquiredOn || acquisition.purchasePrice));
}

export const copyDispositionSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['SOLD', 'DONATED_OUT', 'LOST']),
  occurredOn: copyDateSchema,
  saleAmount: copyMoneySchema.nullish(),
}).refine(value => value.status === 'SOLD' ? value.saleAmount != null : value.saleAmount == null, {
  path: ['saleAmount'], message: 'Enter the amount received for a sold copy only.',
});

export interface CopyLifecycle {
  acquisition_method: CopyAcquisition['method'];
  acquired_on: string | null;
  purchase_price: number | null;
  disposition_on: string | null;
  sale_amount: number | null;
  last_lost_on: string | null;
}
