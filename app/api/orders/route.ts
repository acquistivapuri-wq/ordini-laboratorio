import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";

async function listOrders() {
  const supabase = getServiceSupabase();

  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  const ids = (orders ?? []).map((o) => o.id);
  const { data: lines } = ids.length
    ? await supabase.from("order_lines").select("*").in("order_id", ids).order("sort_order", { ascending: true })
    : { data: [] as any[] };

  const linesByOrder = new Map<string, any[]>();
  for (const line of lines ?? []) {
    const arr = linesByOrder.get(line.order_id) ?? [];
    arr.push(line);
    linesByOrder.set(line.order_id, arr);
  }

  return (orders ?? []).map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    customerName: o.customer_name,
    priority: o.priority,
    notes: o.notes,
    status: o.status,
    createdByName: o.created_by_name,
    createdAt: o.created_at,
    startedAt: o.started_at,
    completedAt: o.completed_at,
    categoryLock: o.category_lock,
    lines: (linesByOrder.get(o.id) ?? []).map((l) => ({
      id: l.id,
      productId: l.product_id,
      skuSnapshot: l.sku_snapshot,
      productNameSnapshot: l.product_name_snapshot,
      categorySnapshot: l.category_snapshot,
      quantity: l.quantity
    }))
  }));
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ orders: await listOrders() });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { customerName, priority, notes, categoryLock, lines } = await request.json();

  if (!customerName || !priority || !Array.isArray(lines) || !lines.length) {
    return NextResponse.json({ error: "Dati ordine incompleti." }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  const { count } = await supabase.from("orders").select("*", { count: "exact", head: true });
  const nextIndex = (count ?? 0) + 1;
  const orderNumber = `OP-${new Date().getFullYear()}-${String(nextIndex).padStart(5, "0")}`;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      customer_name: customerName.trim(),
      priority,
      notes: notes?.trim() || "",
      status: "ORDINE DA LAVORARE",
      created_by_user_id: user.id,
      created_by_name: user.fullName,
      category_lock: categoryLock || null
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message || "Errore creazione ordine." }, { status: 400 });
  }

  const insertLines = lines.map((line: any, index: number) => ({
    order_id: order.id,
    product_id: line.productId,
    sku_snapshot: line.skuSnapshot,
    product_name_snapshot: line.productNameSnapshot,
    category_snapshot: line.categorySnapshot,
    quantity: Number(line.quantity),
    sort_order: index + 1
  }));

  const { error: linesError } = await supabase.from("order_lines").insert(insertLines);
  if (linesError) {
    return NextResponse.json({ error: linesError.message }, { status: 400 });
  }

  return NextResponse.json({ orders: await listOrders() });
}
