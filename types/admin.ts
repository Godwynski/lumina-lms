export type { Category } from "@/lib/types";

export type PolicySetting = {
  id: string;
  key: string;
  value: string;
  description?: string;
  data_type?: string;
  updated_at?: string;
  updated_by?: string;
  created_at?: string;
};
