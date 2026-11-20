"use client";

import { SWRConfig } from "swr";

const swrValue = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 5000,
};

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return <SWRConfig value={swrValue}>{children}</SWRConfig>;
}
