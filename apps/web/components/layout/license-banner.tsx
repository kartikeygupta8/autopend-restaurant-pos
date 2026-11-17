"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface LicenseStatus {
  mode: "OK" | "EXPIRING" | "GRACE" | "READ_ONLY";
  readOnly: boolean;
  message: string | null;
  daysLeft: number | null;
}

// AutoPend hosting: tells staff when the subscription is about to end, has ended, or is suspended.
// Shows nothing for a healthy account and for self-hosted installs (the server has no licence record).
export function LicenseBanner() {
  const { data } = useQuery({
    queryKey: ["license-status"],
    queryFn: () => api.get<LicenseStatus>("/license-status"),
    refetchInterval: 5 * 60_000,
    retry: false,
  });
  if (!data || data.mode === "OK" || !data.message) return null;
  return (
    <p
      role="alert"
      className={
        data.readOnly
          ? "mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
          : "mb-4 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning"
      }
    >
      {data.message}
    </p>
  );
}
