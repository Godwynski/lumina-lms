import { z } from "zod";

export const ViolationSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  violationType: z.string().min(1, "Violation/Offense name is required"),
  severity: z.enum(["minor", "moderate", "major", "severe"]),
  points: z.number().int().min(0).max(100),
  description: z.string().optional().or(z.literal("")),
  incidentDate: z.string().min(1, "Incident date is required"),
});

export const ResolutionSchema = z.object({
  violationId: z.string().uuid("Invalid violation ID"),
  notes: z.string().optional().nullable(),
});

export type ViolationInput = z.infer<typeof ViolationSchema>;
export type ResolutionInput = z.infer<typeof ResolutionSchema>;
