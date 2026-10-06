import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { JWT_COOKIE, verifySession } from "@/lib/auth/jwt";
import { getAdminSupabase } from "@/lib/supabase/server";
import { RoomShell } from "@/components/room/RoomShell";
import { dbUnreachable } from "@/lib/api/guard";
import { BACKEND_ASLEEP_MSG } from "@/lib/constants";

type Params = Promise<{ code: string }>;

export const dynamic = "force-dynamic";

export default async function RoomPage({ params }: { params: Params }) {
  const code = (await params).code.toUpperCase();
  const token = (await cookies()).get(JWT_COOKIE)?.value;
  if (!token) redirect("/");

  const session = await verifySession(token);
  if (!session || session.room_code !== code) {
    redirect("/");
  }

  const supabase = getAdminSupabase();
  const { data: sections, error, status } = await supabase
    .from("sections")
    .select("id, name, category_key, is_custom, order_index")
    .eq("room_id", session.room_id)
    .order("order_index", { ascending: true });

  // without the database the room would render as an empty shell where every
  // click fails, so say what's going on instead
  if (error) {
    return (
      <RoomUnavailable
        code={code}
        message={dbUnreachable({ status }) ? BACKEND_ASLEEP_MSG : "Couldn't load this room. Please try again."}
      />
    );
  }

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

function RoomUnavailable({ code, message }: { code: string; message: string }) {
  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div role="alert" className="panel shadow-soft p-6 max-w-md w-full space-y-4">
        <h1 className="font-display text-lg font-semibold text-text-primary">
          Room {code} is unavailable
        </h1>
        <p className="text-sm leading-relaxed text-text-secondary">{message}</p>
        <div className="flex gap-2">
          <Link
            href={`/room/${code}`}
            prefetch={false}
            className="flex-1 h-10 inline-flex items-center justify-center rounded-md bg-accent-cyan text-white text-sm font-medium hover:bg-[#6E9AF2]"
          >
            Try again
          </Link>
          <Link
            href="/"
            className="flex-1 h-10 inline-flex items-center justify-center rounded-md border border-border text-sm text-text-primary hover:bg-bg-elevated"
          >
            Back to start
          </Link>
        </div>
      </div>
    </main>
  );
}
