export async function communityJson(
  request: Request,
  limit = 32768,
): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length") || 0) > limit)
    throw Error("Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw Error("Request body is missing.");
  const decoder = new TextDecoder();
  let size = 0,
    text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw Error("Request is too large.");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw Error("Invalid request body.");
    return body;
  } finally {
    reader.releaseLock();
  }
}
