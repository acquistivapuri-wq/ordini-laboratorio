import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
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

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(user)) return NextResponse.json({ error: "Non autorizzato." }, { status: 403 });

  return NextResponse.json({ users: await listUsers() });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(user)) return NextResponse.json({ error: "Non autorizzato." }, { status: 403 });

  const { username, fullName, password, role } = await request.json();
  if (!username || !fullName || !password || !role) {
    return NextResponse.json({ error: "Compila tutti i campi utente." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("app_users").insert({
    username: username.trim(),
    full_name: fullName.trim(),
    password_hash: passwordHash,
    role,
    is_active: true
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ users: await listUsers() });
}
