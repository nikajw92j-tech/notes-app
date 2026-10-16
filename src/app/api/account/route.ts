import { NextResponse } from "next/server";
import { ApiError, route, parseJson } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKETS } from "@/lib/services/storage";
import { deleteAccountSchema } from "@/lib/validation";

/**
 * Permanently delete the signed-in user's account. Requires { confirm: "DELETE" }.
 * Storage objects are removed first; database rows cascade from auth.users.
 */
export const DELETE = route(
  async ({ req, supabase, user }) => {
    await parseJson(req, deleteAccountSchema);
    const admin = createAdminClient();

    for (const bucket of Object.keys(BUCKETS)) {
      const { data: files } = await admin.storage.from(bucket).list(user.id, { limit: 1000 });
      const paths = (files ?? []).map((f) => `${user.id}/${f.name}`);
      if (paths.length) await admin.storage.from(bucket).remove(paths);
    }

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      console.error("[account delete]", error);
      throw new ApiError(500, "delete_failed", "Could not delete account");
    }
    await supabase.auth.signOut().catch(() => undefined);
    return NextResponse.json({ deleted: true });
  },
  { rateLimit: { name: "account:delete", limit: 3, windowMs: 60 * 60_000 } },
);
