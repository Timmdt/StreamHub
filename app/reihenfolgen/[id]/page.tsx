import { redirect } from "next/navigation";

type WatchOrderPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LegacyWatchOrderPage({ params }: WatchOrderPageProps) {
  const { id } = await params;

  redirect(`/watch-orders/${encodeURIComponent(id)}`);
}
