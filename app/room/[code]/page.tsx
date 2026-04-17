import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { JWT_COOKIE, verifySession } from "@/lib/auth/jwt";
import { getAdminSupabase } from "@/lib/supabase/server";
import { RoomShell } from "@/components/room/RoomShell";

type Params = { code: string };

export const dynamic = "force-dynamic";

export default async function RoomPage({ params }: { params: Params }) {
  const code = params.code.toUpperCase();
  const token = cookies().get(JWT_COOKIE)?.value;
  if (!token) redirect("/");

  const session = await verifySession(token);
  if (!session || session.room_code !== code) {
    redirect("/");
  }

  const supabase = getAdminSupabase();
  const { data: sections } = await supabase
    .from("sections")
    .select("id, name, category_key, is_custom, order_index")
    .eq("room_id", session.room_id)
    .order("order_index", { ascending: true });

  return (
    <RoomShell
      me={{
        room_id: session.room_id,
        room_code: session.room_code,
        fingerprint: session.fingerprint,
        display_name: session.display_name,
        color: session.color,
        token,
      }}
      initialSections={sections ?? []}
    />
  );
}
