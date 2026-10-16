import { route, parseJson } from "@/lib/api";
import { parseId } from "@/lib/params";
import { deleteFolder, updateFolder } from "@/lib/services/folders";
import { folderUpdateSchema } from "@/lib/validation";

type P = { id: string };

export const PATCH = route<P>(async ({ req, params, supabase, user }) =>
  updateFolder(supabase, user.id, parseId(params.id), await parseJson(req, folderUpdateSchema)),
);

/** Notes in the folder are kept and become unfiled. */
export const DELETE = route<P>(async ({ params, supabase, user }) => {
  await deleteFolder(supabase, user.id, parseId(params.id));
});
