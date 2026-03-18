"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { DEFAULT_POLICIES } from "./policy-constants";

export async function getSystemSettings() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("system_settings")
    .select("*")
    .order("key", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}

export async function getSystemSetting(key: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("system_settings")
    .select("*")
    .eq("key", key)
    .single();

  if (error && error.code !== "PGRST116") throw new Error(error.message);
  return data;
}

export async function updateSystemSetting(
  key: string,
  value: string,
  updatedBy: string,
  description?: string
) {
  const supabase = await createClient();

  // Check if setting exists
  const existing = await getSystemSetting(key);

  if (existing) {
    const { error } = await supabase
      .from("system_settings")
      .update({
        value,
        description,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("system_settings").insert([
      {
        key,
        value,
        description,
        updated_by: updatedBy,
      },
    ]);

    if (error) throw new Error(error.message);
  }

  revalidatePath("/protected/admin");
  return true;
}

export async function initializeDefaultSettings(adminId: string) {
  const supabase = await createClient();

  // Check if already initialized
  const existing = await getSystemSettings();
  if (existing && existing.length > 0) {
    return { error: "Settings already initialized" };
  }

  const settings = Object.entries(DEFAULT_POLICIES).map(([key, config]) => ({
    key,
    value: config.value,
    description: config.description,
    updated_by: adminId,
  }));

  const { error } = await supabase.from("system_settings").insert(settings);

  if (error) throw new Error(error.message);

  revalidatePath("/protected/admin");
  return { success: true };
}

// Categories
export async function getCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}

export async function getAllCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}

export async function createCategory(
  name: string,
  slug: string,
  description?: string
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .insert([{ name, slug, description, is_active: true }])
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/protected/admin");
  return data;
}

export async function updateCategory(
  id: string,
  name: string,
  slug: string,
  description?: string,
  is_active?: boolean
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .update({
      name,
      slug,
      description,
      is_active: is_active !== undefined ? is_active : true,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/protected/admin");
  return data;
}

export async function deleteCategory(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("categories")
    .update({ is_active: false })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/protected/admin");
  return true;
}

export async function restoreCategory(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("categories")
    .update({ is_active: true })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/protected/admin");
  return true;
}