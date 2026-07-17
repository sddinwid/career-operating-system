export const JOB_DESCRIPTION_FORMAT_VERSION = "job-description-text.v1";
export const MAX_JOB_DESCRIPTION_CHARACTERS = 200_000;

export function normalizeJobDescriptionText(input: string) {
  const normalizedLineEndings = input.replace(/\r\n?/g, "\n");
  const trimmedLines = normalizedLineEndings
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""));
  const collapsedBlankLines = trimmedLines.join("\n").replace(/\n{3,}/g, "\n\n");

  return collapsedBlankLines.trim();
}

export function countJobDescriptionWords(text: string) {
  const matches = text.match(/\S+/g);
  return matches?.length ?? 0;
}

export function abbreviateChecksum(checksum: string) {
  return checksum.slice(0, 12);
}
