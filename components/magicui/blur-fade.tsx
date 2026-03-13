"use client";

import { motion, Variants } from "framer-motion";

interface BlurFadeProps {
  children: React.ReactNode;
  className?: string;
  variant?: {
    hidden: { y: number };
    visible: { y: number };
  };
  duration?: number;
  delay?: number;
  yOffset?: number;
  inView?: boolean;
  inViewMargin?: string;
  blur?: string;
}

export default function BlurFade({
  children,
  className,
  variant,
  duration = 0.4,
  delay = 0,
  yOffset = 6,
  inView = false,
  inViewMargin = "-50px",
  blur = "6px",
}: BlurFadeProps) {
  const defaultVariants: Variants = {
    hidden: { y: yOffset, opacity: 0, filter: `blur(${blur})` },
    visible: { y: -yOffset, opacity: 1, filter: `blur(0px)` },
  };
  const combinedVariants = variant || defaultVariants;
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      whileInView={inView ? "visible" : undefined}
      viewport={{ once: true, margin: inViewMargin }}
      transition={{
        delay,
        duration,
        ease: "easeOut",
      }}
      variants={combinedVariants}
      className={className}
    >
      {children}
    </motion.div>
  );
}
