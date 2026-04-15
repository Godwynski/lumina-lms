import { z } from "zod";

export const ViolationSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  violationType: z.enum(["Unreturned Book", "Damaged Book"]),
  description: z.string().optional().or(z.literal("")),
  incidentDate: z.string().min(1, "Incident date is required"),
});

export const ResolutionSchema = z.object({
  violationId: z.string().uuid("Invalid violation ID"),
  notes: z.string().optional().nullable(),
});

export type ViolationInput = z.infer<typeof ViolationSchema>;
export type ResolutionInput = z.infer<typeof ResolutionSchema>;
