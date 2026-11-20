"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { FieldControlIdContext, useFieldControlId } from "@/components/ui/field-context";

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
);

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, htmlFor, ...props }, ref) => {
  // Inside a <Field>, the label points at that field's control automatically.
  const controlId = useFieldControlId(htmlFor);
  return (
    <LabelPrimitive.Root
      ref={ref}
      htmlFor={controlId}
      className={cn(labelVariants(), className)}
      {...props}
    />
  );
});
Label.displayName = LabelPrimitive.Root.displayName;

/** A wrapper that links the <Label> inside it to the one form control inside it. */
function Field({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const id = React.useId();
  return (
    <FieldControlIdContext.Provider value={id}>
      <div className={className} {...props}>
        {children}
      </div>
    </FieldControlIdContext.Provider>
  );
}

export { Label, Field };
