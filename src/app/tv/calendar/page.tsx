import { prisma } from "@/lib/prisma";
import { getNumberedEvents, normalizeView } from "@/lib/tv-calendar";
import TvCalendarClient from "@/components/TvCalendarClient";

export const dynamic = "force-dynamic";

export default async function TvCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; anchor?: string }>;
}) {
  const params = await searchParams;
  const view = normalizeView(params.view);

  const anchorRaw = params.anchor ? new Date(params.anchor) : new Date();
  const anchor = Number.isNaN(anchorRaw.getTime()) ? new Date() : anchorRaw;

  // ВАЖНО: getNumberedEvents также обновляет TvViewState(id="tv"),
  // поэтому голосовая ссылка «событие N» совпадает с тем, что на экране.
  const [data, categories] = await Promise.all([
    getNumberedEvents(view, anchor),
    prisma.category.findMany({ orderBy: { order: "asc" } }),
  ]);

  const legend = categories.map((c: { name: string; color: string }) => ({
    name: c.name,
    color: c.color,
  }));

  return <TvCalendarClient data={data} legend={legend} />;
}
