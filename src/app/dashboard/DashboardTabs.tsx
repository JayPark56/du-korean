"use client";

import type { ReactNode } from "react";
import { useHash } from "@/lib/hashTabs";

/** Tab hashes in navbar order; the first is the default. */
export const DASHBOARD_TABS = ["#schedule", "#requests", "#profile"] as const;

/**
 * Shows only the section for the current hash tab. Inactive sections stay mounted
 * (just hidden), so unsaved edits survive switching tabs.
 */
export default function DashboardTabs({
  schedule,
  requests,
  profile,
}: {
  schedule: ReactNode;
  requests: ReactNode;
  profile: ReactNode;
}) {
  const hash = useHash();
  const active = (DASHBOARD_TABS as readonly string[]).includes(hash) ? hash : DASHBOARD_TABS[0];
  const panels: [string, ReactNode][] = [
    ["#schedule", schedule],
    ["#requests", requests],
    ["#profile", profile],
  ];

  return (
    <>
      {panels.map(([tab, content]) => (
        <div key={tab} data-tab={tab.slice(1)} hidden={tab !== active}>
          {content}
        </div>
      ))}
    </>
  );
}
