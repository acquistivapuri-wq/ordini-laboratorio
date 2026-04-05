import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { canManageProducts } from "@/lib/permissions";
import { getSessionUser } from "@/lib/auth";

async function listProducts() {
  const supabase = getServiceSupabase();
  const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
  return data ?? [];
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ products: await listProducts() });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageProducts(user)) return NextResponse.json({ error: "Non autorizzato." }, { status: 403 });

  const { sku, name, category } = await request.json();
  if (!sku || !name || !category) {
    return NextResponse.json({ error: "SKU, nome e categoria sono obbligatori." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { error } = await supabase.from("products").insert({
    sku: sku.trim(),
    name: name.trim(),
    category: category.trim(),
    is_active: true
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ products: await listProducts() });
}
