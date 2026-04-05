import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadInstructionMarkdown } from "@/lib/load-instruction";
import { APP_VERSION_DISPLAY } from "@/lib/app-version";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const md = await loadInstructionMarkdown();
  const name = `nash-dnevnik-instrukciya-${APP_VERSION_DISPLAY.replace(/\s+/g, "-")}.md`;
  return new NextResponse(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
