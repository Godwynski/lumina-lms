import { cn } from "@/lib/utils";

export function Logo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <div className={cn("relative flex items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20 p-2", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-primary-foreground"
      >
        <path d="M4 3h5v18H4z" fill="currentColor" />
        <path d="M11 9l8 3-8 3z" fill="currentColor" />
      </svg>
    </div>
  );
}
