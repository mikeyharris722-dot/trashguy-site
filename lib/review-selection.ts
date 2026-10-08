import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
const filename = () =>
  path.join(process.cwd(), ".local", "review-native-selection.json");
export async function reviewNativeSelection() {
  if (process.env.NEXT_PUBLIC_LOCAL_REVIEW !== "1") return "";
  try {
    const data = JSON.parse(await fs.readFile(filename(), "utf8"));
    return typeof data.huntId === "string" ? data.huntId : "";
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw e;
  }
}
export async function saveReviewNativeSelection(huntId: string) {
  if (process.env.NEXT_PUBLIC_LOCAL_REVIEW !== "1")
    throw Error("Local review only.");
  const file = filename();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = file + "." + randomUUID() + ".tmp";
  await fs.writeFile(temp, JSON.stringify({ huntId }));
  await fs.rename(temp, file);
}
