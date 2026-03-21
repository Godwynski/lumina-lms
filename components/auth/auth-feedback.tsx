import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type AuthErrorAlertProps = {
  message: string;
  className?: string;
};

export function AuthErrorAlert({ message, className }: AuthErrorAlertProps) {
  return (
    <Alert
      variant="destructive"
      className={cn("border-red-200 bg-red-50 text-red-700", className)}
    >
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
