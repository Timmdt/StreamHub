import { redirect } from "next/navigation";

type LegacyDiscoverPageProps = {
  searchParams: Promise<{ kategorie?: string | string[]; category?: string | string[] }>;
};

export default async function LegacyDiscoverPage({ searchParams }: LegacyDiscoverPageProps) {
  const params = await searchParams;
  const rawCategoryId = params.category ?? params.kategorie;
  const categoryId = Array.isArray(rawCategoryId) ? rawCategoryId[0] : rawCategoryId;

  redirect(categoryId ? `/discover?category=${encodeURIComponent(categoryId)}` : "/discover");
}
