'use client';

import React from 'react';
import { usePathname } from "next/navigation";
import { m } from "framer-motion";

export default function NavAnimatePresence({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <m.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
    >
      {children}
    </m.div>
  );
}
