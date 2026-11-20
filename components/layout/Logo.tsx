import { cn } from "@/lib/utils";
import Image from "next/image";

export function Logo({ size = 24, className = "" }: { size?: number; className?: string }) {
  // In the old design, `size` was the inner icon, and `p-2` added 16px of padding to the container.
  // Since the new icon.svg has its own background, we add 16 to `size` so the overall footprint matches.
  const overallSize = size + 16;

  return (
    <div className={cn("relative flex items-center justify-center rounded-xl overflow-hidden shadow-lg", className)}>
      <Image
        src="/icon.svg"
        alt="System Logo"
        width={overallSize}
        height={overallSize}
        className="object-contain"
        priority
      />
    </div>
  );
}
