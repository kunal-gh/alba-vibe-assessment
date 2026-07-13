import { redirect } from "next/navigation";

/**
 * StudioFlow is the assessment submission surface. The imported photography
 * portfolio remains available in the source as a design foundation, but the
 * deployed root intentionally takes a reviewer straight to the dashboard.
 */
export default function Home() {
  redirect("/studio");
}
