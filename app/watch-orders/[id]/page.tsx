import { StreamHubApp } from "@/components/StreamHubApp";

type WatchOrderPageProps = {
  params: Promise<{ id: string }>;
};

export default async function WatchOrderPage({ params }: WatchOrderPageProps) {
  const { id } = await params;

  return <StreamHubApp initialView="orders" initialOrderId={id} />;
}
