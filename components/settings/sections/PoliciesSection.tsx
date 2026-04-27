"use client";

import { use, Suspense } from "react";
import { Section } from "../SettingsShared";
import { SettingsShell } from "../SettingsShell";
import { PolicyLayout } from "@/components/admin/policies/PolicyLayout";

import { PolicySetting, Category } from "@/types/admin";

interface PoliciesSectionProps {
  role: string;
  settingsPromise: Promise<PolicySetting[]> | PromiseLike<PolicySetting[]>;
  categoriesPromise: Promise<Category[]> | PromiseLike<Category[]>;
}

export function PoliciesSection({ role, settingsPromise, categoriesPromise }: PoliciesSectionProps) {
  const isSuperAdmin = role === "admin";

  return (
    <SettingsShell>
      <Section>
        <Suspense fallback={<div className="h-32 w-full animate-pulse bg-muted rounded-xl" />}>
          <PolicyStreamWrapper promise={settingsPromise} categoriesPromise={categoriesPromise} canEdit={isSuperAdmin} />
        </Suspense>
      </Section>
    </SettingsShell>
  );
}

function PolicyStreamWrapper({ 
  promise, 
  categoriesPromise, 
  canEdit 
}: { 
  promise: Promise<PolicySetting[]> | PromiseLike<PolicySetting[]>, 
  categoriesPromise: Promise<Category[]> | PromiseLike<Category[]>,
  canEdit: boolean 
}) {
  const data = use(promise) as PolicySetting[];
  return <PolicyLayout settings={data} canEdit={canEdit} categoriesPromise={categoriesPromise} />;
}
