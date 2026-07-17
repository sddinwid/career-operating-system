import { createHash } from "node:crypto";

export function computeJobDescriptionChecksum(normalizedText: string) {
  return createHash("sha256").update(normalizedText, "utf8").digest("hex");
}
