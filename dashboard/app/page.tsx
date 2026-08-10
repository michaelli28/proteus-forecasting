import { redirect } from "next/navigation";

/** The dashboard is the metrics page; there is nothing else to land on yet. */
export default function Home() {
  redirect("/metrics");
}
