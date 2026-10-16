export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-100 px-4 py-10 dark:bg-neutral-700">
      {children}
    </main>
  );
}
