import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg p-6 text-center">
      <Logo />
      <h1 className="text-preset-1 text-fg">404</h1>
      <Link
        href="/notes"
        className="focus-ring inline-flex h-[41px] items-center rounded-lg bg-blue-500 px-4 text-preset-4 text-white hover:bg-blue-700"
      >
        ← Notes
      </Link>
    </main>
  );
}
