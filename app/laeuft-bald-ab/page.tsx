import { redirect } from "next/navigation";

export default function LegacyExpiringPage() {
  redirect("/expiring-soon");
}
