'use client';

import React from 'react';
import { usePathname } from "next/navigation";
import { m, AnimatePresence } from "framer-motion";

export default function NavAnimatePresence({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <m.div
        key={pathname}
        initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
}
