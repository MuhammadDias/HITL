import type { Buffer } from "node:buffer";

export type ManifestChange = { status: string; path: string; kind: "tracked" | "untracked" };
export type OwnerBuildManifest = { schemaVersion: 1; generatedAt: string; packageVersion: string; git: { headSha: string; shortSha: string; dirty: boolean; state: "CLEAN" | "DIRTY"; trackedChangeCount: number; untrackedFileCount: number; statusFilter: string; changes: ManifestChange[]; shaIsCleanSourceEvidence: boolean; evidenceType: "SOURCE_SNAPSHOT_NOT_BUILD_PROOF" } };
export function createManifest(repo: string, now?: Date): OwnerBuildManifest;
export function parseStatus(buffer: Buffer): ManifestChange[];
