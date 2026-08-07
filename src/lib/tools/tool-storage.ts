import fs from "node:fs/promises";

const EVENT_TAIL_CHUNK_BYTES = 64 * 1024;

/** Read only enough of a JSONL file to return its requested trailing lines. */
export async function readJsonLinesTail(
  filePath: string,
  lineLimit: number,
  accepts: (line: string) => boolean = () => true,
): Promise<string> {
  let handle: Awaited<ReturnType<typeof fs.open>> | null = null;
  try {
    handle = await fs.open(filePath, "r");
    const stat = await handle.stat();
    let position = stat.size;
    let buffer = Buffer.alloc(0);
    let acceptedCount = 0;
    while (position > 0 && acceptedCount < lineLimit) {
      const size = Math.min(EVENT_TAIL_CHUNK_BYTES, position);
      position -= size;
      const chunk = Buffer.allocUnsafe(size);
      await handle.read(chunk, 0, size, position);
      buffer = Buffer.concat([chunk, buffer]);
      const lines = buffer.toString("utf8").split("\n").filter(Boolean);
      if (position > 0) lines.shift();
      acceptedCount = lines.filter(accepts).length;
    }
    return buffer.toString("utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  } finally {
    await handle?.close();
  }
}
