import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { canManageProducts } from "@/lib/permissions";
import { getSessionUser } from "@/lib/auth";

async function listProducts() {
  const supabase = getServiceSupabase();
  const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
  return data ?? [];
}

export async function PATCH(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageProducts(user)) return NextResponse.json({ error: "Non autorizzato." }, { status: 403 });

  const { id } = await context.params;
  const supabase = getServiceSupabase();
  const { data: current } = await supabase.from("products").select("is_active").eq("id", id).single();
  if (!current) return NextResponse.json({ error: "Prodotto non trovato." }, { status: 404 });

  const { error } = await supabase.from("products").update({ is_active: !current.is_active }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ products: await listProducts() });
}
