import type { ImportJob } from "@/features/import/types/import.types";

/** The currency lane a job belongs to, derived from its backend jobType. */
export type ChannelMeta = {
  /** Backend `broker` value stamped on transactions from this channel. */
  broker: string;
  /** ISO currency code stamped on those transactions. */
  currency: "USD" | "MXN";
  /** Short label for UI. */
  label: string;
};

/**
 * Maps a job's `jobType` to its channel. DriveWealth confirmations land as USD
 * under the DriveWealth custodian; GBM monthly statements as MXN under GBM.
 * Returns null when the type is unrecognized (older/unknown jobs).
 */
export function channelOfJobType(jobType: string | null): ChannelMeta | null {
  if (!jobType) return null;
  if (/DRIVE|DW/i.test(jobType)) {
    return { broker: "DriveWealth", currency: "USD", label: "DriveWealth" };
  }
  if (/GBM|STATEMENT|MXN|NACIONAL/i.test(jobType)) {
    return { broker: "GBM", currency: "MXN", label: "GBM" };
  }
  return null;
}

export function channelOfJob(job: Pick<ImportJob, "jobType">): ChannelMeta | null {
  return channelOfJobType(job.jobType);
}
