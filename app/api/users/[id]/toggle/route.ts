import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { canManageUsers } from "@/lib/permissions";
import { getSessionUser } from "@/lib/auth";

async function listUsers() {
  const supabase = getServiceSupabase();
  const { data } = await supabase
    .from("app_users")
    .select("id, username, full_name, role, is_active, created_at")
    .order("created_at", { ascending: false });

  return (data ?? []).map((u) => ({
    id: u.id,
    username: u.username,
    fullName: u.full_name,
    role: u.role,
    isActive: u.is_active
  }));
}

export async function PATCH(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(user)) return NextResponse.json({ error: "Non autorizzato." }, { status: 403 });

  const { id } = await context.params;
  const supabase = getServiceSupabase();
  const { data: current } = await supabase.from("app_users").select("is_active").eq("id", id).single();
  if (!current) return NextResponse.json({ error: "Utente non trovato." }, { status: 404 });

  const { error } = await supabase.from("app_users").update({ is_active: !current.is_active }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ users: await listUsers() });
}
