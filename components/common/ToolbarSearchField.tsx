import type { KeyboardEventHandler } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ToolbarSearchFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
}

export function ToolbarSearchField({
  label,
  placeholder,
  value,
  onChange,
  onClear,
  onKeyDown,
}: ToolbarSearchFieldProps) {
  return (
    <>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        className="app-toolbar-control w-full border-border/50 bg-background pl-9 pr-11 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Clear search"
          className="absolute right-1 top-1/2 size-9 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={onClear}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      )}
    </>
  );
}
