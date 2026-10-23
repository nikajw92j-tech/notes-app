import { Suspense } from "react";
import { GuestStart } from "@/components/auth/guest-start";

export const metadata = { title: "Notes" };

export default function StartPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-100 px-4 dark:bg-neutral-700">
      <Suspense>
        <GuestStart />
      </Suspense>
    </main>
  );
}
