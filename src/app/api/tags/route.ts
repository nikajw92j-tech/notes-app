import { route } from "@/lib/api";
import { listTags } from "@/lib/services/folders";

export const GET = route(async ({ supabase, user }) => listTags(supabase, user.id));
