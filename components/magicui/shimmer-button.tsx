"use client";

import React, { CSSProperties, ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export interface ShimmerButtonProps extends ComponentPropsWithoutRef<"button"> {
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
  className?: string;
  children?: React.ReactNode;
}

const ShimmerButton = React.forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  (
    {
      shimmerColor = "#ffffff",
      shimmerSize = "0.1em",
      shimmerDuration = "3s",
      borderRadius = "100px",
      background = "rgba(0, 0, 0, 1)",
      className,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        style={
          {
            "--shimmer-color": shimmerColor,
            "--shimmer-size": shimmerSize,
            "--shimmer-duration": shimmerDuration,
            "--border-radius": borderRadius,
            "--background": background,
          } as CSSProperties
        }
        className={cn(
          "group relative flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap border border-white/10 px-6 py-3 text-white [background:var(--background)] [border-radius:var(--border-radius)]",
          "transform-gpu transition-all duration-300 ease-in-out active:scale-95 hover:shadow-[0_0_20px_rgba(0,0,0,0.1)]",
          className,
        )}
        ref={ref}
        {...props}
      >
        {/* spark container */}
        <div
          className={cn(
            "-z-10 absolute inset-0 overflow-visible [container-type:size]",
          )}
        >
          {/* spark */}
          <div className="absolute inset-0 h-[100cqh] animate-shimmer-button-shimmer [aspect-ratio:1] [background:conic-gradient(from_0deg_at_50%_50%,transparent_0deg,var(--shimmer-color)_15deg,transparent_30deg)] [border-radius:inherit] [inset:0_0_0_-100%]" />
        </div>
        
        <div className="z-10 flex items-center justify-center gap-2">
          {children}
        </div>

        {/* backdrop */}
        <div
          className={cn(
            "insert-0 absolute size-full rounded-2xl px-4 py-1.5 text-sm font-medium shadow-[inset_0_-8px_10px_#ffffff1f] transition-all duration-300 ease-in-out",
            "bg-gradient-to-b from-white/10 to-transparent opacity-0 group-hover:opacity-100",
          )}
        />

        {/* content glass effect */}
        <div className="absolute inset-x-0 bottom-px mx-auto h-px w-[80%] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      </button>
    );
  },
);

ShimmerButton.displayName = "ShimmerButton";

export { ShimmerButton };
