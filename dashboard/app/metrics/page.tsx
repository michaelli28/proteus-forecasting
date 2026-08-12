import { redirect } from "next/navigation";

/** Renamed to /calibration in plain language. Keep the old path working. */
export default function MetricsPage() {
  redirect("/calibration");
}
