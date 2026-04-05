import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getServiceSupabase } from "@/lib/supabase";
import { createSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json({ error: "Username e password obbligatori." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data: user, error } = await supabase
    .from("app_users")
    .select("id, username, full_name, password_hash, role, is_active")
    .eq("username", username)
    .single();

  if (error || !user || !user.is_active) {
    return NextResponse.json({ error: "Credenziali non valide." }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "Credenziali non valide." }, { status: 401 });
  }

  await createSessionCookie({
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role
  });

  return NextResponse.json({ ok: true });
}
