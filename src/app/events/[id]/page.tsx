import type { Metadata } from "next";
import { EVENTS } from "@/lib/data";
import { EventDetailClient } from "./EventDetailClient";

export function generateStaticParams() {
  return EVENTS.map((e) => ({ id: e.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = EVENTS.find((e) => e.id === id);
  return { title: event?.title || "Event" };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EventDetailClient id={id} />;
}
