import { StreamHubApp } from "@/components/StreamHubApp";

type DiscoverPageProps = {
  searchParams: Promise<{ category?: string | string[] }>;
};

export default async function DiscoverPage({ searchParams }: DiscoverPageProps) {
  const params = await searchParams;
  const rawCategoryId = Array.isArray(params.category) ? params.category[0] : params.category;
  const parsedCategoryId = rawCategoryId ? Number(rawCategoryId) : null;
  const categoryId = parsedCategoryId !== null && Number.isInteger(parsedCategoryId) ? parsedCategoryId : null;

  return <StreamHubApp initialView="discover" initialCategoryId={categoryId} />;
}
