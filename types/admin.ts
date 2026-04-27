export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  is_active: boolean;
  created_at?: string;
}

export type PolicySetting = {
  id: string;
  key: string;
  value: string;
  description?: string;
};
