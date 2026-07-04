// apps/tours/web/src/app/page.tsx
// Root route placeholder — Task 1 just redirects to /login (auth lib lands in Task 3).
// Task 3 will add the real session check + role-aware redirect (UI-SPEC S2 dashboard in Plan 02).
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/login");
}