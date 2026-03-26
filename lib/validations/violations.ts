import { z } from "zod";

export const ViolationSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  violationType: z.string().min(1, "Violation type is required"),
  severity: z.enum(["low", "medium", "high", "critical"]),
  points: z.number().int().min(0).max(100),
  description: z.string().min(1, "Description is required"),
  incidentDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/)),
});

export const ResolutionSchema = z.object({
  violationId: z.string().uuid("Invalid violation ID"),
  notes: z.string().optional().nullable(),
});

export type ViolationInput = z.infer<typeof ViolationSchema>;
export type ResolutionInput = z.infer<typeof ResolutionSchema>;
