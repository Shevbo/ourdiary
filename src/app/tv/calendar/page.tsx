import { prisma } from "@/lib/prisma";
import { getNumberedEvents, normalizeView } from "@/lib/tv-calendar";
import { getOrCreateUploadToken } from "@/lib/upload-token-db";
import { uploadUrlForToken } from "@/lib/upload-token";
import { qrDataUrl } from "@/lib/qr";
import TvCalendarClient, {
  type TvAttachment,
  type EventExtras,
} from "@/components/TvCalendarClient";

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

  // VAZHNO: getNumberedEvents takzhe obnovlyaet TvViewState(id="tv"),
  // poetomu golosovaya ssylka "sobytie N" sovpadaet s tem, chto na ekrane.
  const [data, categories] = await Promise.all([
    getNumberedEvents(view, anchor),
    prisma.category.findMany({ orderBy: { order: "asc" } }),
  ]);

  const legend = categories.map((c: { name: string; color: string }) => ({
    name: c.name,
    color: c.color,
  }));

  // Dopolnitelnye dannye tolko dlya POKAZANNYH sobytij: vlozheniya + QR na zagruzku.
  const eventIds = data.events.map((e) => e.id);

  const attachments = eventIds.length
    ? await prisma.attachment.findMany({
        where: { eventId: { in: eventIds } },
        orderBy: { createdAt: "asc" },
        select: { id: true, eventId: true, kind: true, path: true, text: true, caption: true },
      })
    : [];

  const attByEvent = new Map<string, TvAttachment[]>();
  for (const a of attachments) {
    const arr = attByEvent.get(a.eventId) ?? [];
    arr.push({ id: a.id, kind: a.kind, path: a.path, text: a.text, caption: a.caption });
    attByEvent.set(a.eventId, arr);
  }

  // Tokeny/QR generim tolko dlya pokazannyh sobytij (pereispolzuem aktivnyj token).
  const extras: Record<string, EventExtras> = {};
  await Promise.all(
    eventIds.map(async (id) => {
      const { token } = await getOrCreateUploadToken(id);
      const url = uploadUrlForToken(token);
      const qr = await qrDataUrl(url);
      extras[id] = { uploadUrl: url, qr, attachments: attByEvent.get(id) ?? [] };
    })
  );

  return <TvCalendarClient data={data} legend={legend} extras={extras} />;
}
