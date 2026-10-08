import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

export const localCommunity = () =>
  process.env.NODE_ENV !== "production" &&
  process.env.COMMUNITY_HUNT_LOCAL === "1";
type Document = "hunts" | "catalogue";
type Receipt = {
  actor_id: string;
  document: string;
  fingerprint: string;
  result: unknown;
};
const filename = (document: Document) =>
  path.join(
    process.cwd(),
    ".local",
    document === "hunts" ? "community-hunts.json" : "rainbet-catalogue.json",
  );
async function db() {
  return (await import("./site-db")).siteDb();
}
export function requestKey(
  body: Record<string, unknown>,
  actor: string,
  document: Document,
) {
  const request = String(body.requestId || randomUUID());
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      request,
    )
  )
    throw Error("Invalid request ID.");
  const payload = { ...body };
  delete payload.requestId;
  // Sort keys so equivalent retries have the same identity.
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify([
        document,
        actor,
        Object.fromEntries(Object.entries(payload).sort()),
      ]),
    )
    .digest("hex");
  return { request, fingerprint };
}
export async function readDocument<T>(
  document: Document,
  fallback: T,
): Promise<{ payload: T; version: number }> {
  if (localCommunity()) {
    try {
      return {
        payload: JSON.parse(await fs.readFile(filename(document), "utf8")),
        version: 0,
      };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT")
        return { payload: structuredClone(fallback), version: 0 };
      throw e;
    }
  }
  const { data, error } = await (
    await db()
  )
    .from("community_documents")
    .select("payload,version")
    .eq("id", document)
    .single();
  if (error)
    throw Error("Community Hunt storage is unavailable. " + error.message);
  return { payload: data.payload as T, version: Number(data.version) };
}
export async function receipt(
  document: Document,
  actor: string,
  key: { request: string; fingerprint: string },
): Promise<Receipt | null> {
  if (localCommunity()) return null;
  const { data, error } = await (
    await db()
  )
    .from("community_requests")
    .select("actor_id,document,fingerprint,result")
    .eq("request_id", key.request)
    .maybeSingle();
  if (error) throw Error(error.message);
  if (
    data &&
    (data.actor_id !== actor ||
      data.document !== document ||
      data.fingerprint !== key.fingerprint)
  )
    throw Error("This request ID was already used for another action.");
  return data;
}
export async function commitDocument(
  document: Document,
  payload: unknown,
  version: number,
  result: unknown,
  actor: string,
  key: { request: string; fingerprint: string },
): Promise<{ committed: boolean; result: unknown }> {
  if (localCommunity()) {
    const file = filename(document);
    await fs.mkdir(path.dirname(file), { recursive: true });
    if (document === "catalogue") {
      try {
        await fs.copyFile(file, file + ".backup");
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
    }
    const tmp = file + "." + randomUUID() + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(payload));
    await fs.rename(tmp, file);
    return { committed: true, result };
  }
  const { data, error } = await (
    await db()
  ).rpc("community_commit", {
    p_document: document,
    p_expected: version,
    p_payload: payload,
    p_actor: actor,
    p_request: key.request,
    p_fingerprint: key.fingerprint,
    p_result: result,
  });
  if (error) throw Error(error.message);
  return data as { committed: boolean; result: unknown };
}
