import { readFile } from "fs/promises";
import path from "path";
import { APP_VERSION_DISPLAY } from "./app-version";

export async function loadInstructionMarkdown(): Promise<string> {
  const file = path.join(process.cwd(), "src", "content", "instruction.md");
  const raw = await readFile(file, "utf-8");
  return raw.replace(/\{\{VERSION\}\}/g, APP_VERSION_DISPLAY);
}
