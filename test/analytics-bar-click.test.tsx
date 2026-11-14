import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { PeakHoursBarChart } from '@/app/(authenticated)/analytics/AnalyticsCharts';
vi.mock('recharts', () => {
 const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
 return { ResponsiveContainer: Box, BarChart: Box, CartesianGrid: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null,
   Bar: ({ onClick }: { onClick: (entry: unknown, index: number) => void }) => <button onClick={() => onClick({ payload: { hour: '10 AM', count: 10 } }, 0)}>Ten AM bar</button> };
});
it('uses the clicked bar payload rather than the rendered bar index', async () => {
 (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
 const el = document.body.appendChild(document.createElement('div')); const root = createRoot(el); const select = vi.fn();
 try {
  await act(async () => root.render(<PeakHoursBarChart data={[{ hour: '8 AM', count: 0 }, { hour: '9 AM', count: 0 }, { hour: '10 AM', count: 10 }]} title="Hours" color="blue" onSelect={select} />));
  await act(async () => el.querySelector<HTMLButtonElement>('button')!.click());
  expect(select).toHaveBeenCalledWith('10 AM');
 } finally { act(() => root.unmount()); el.remove(); }
});
