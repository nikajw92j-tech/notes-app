import { Suspense } from "react";
import { NotesWorkspace } from "@/components/notes/notes-workspace";

export const metadata = { title: "Notes" };

export default function NotesPage() {
  return (
    <Suspense>
      <NotesWorkspace />
    </Suspense>
  );
}
