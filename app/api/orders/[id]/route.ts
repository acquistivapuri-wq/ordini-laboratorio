import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
import { canDeleteOrders } from "@/lib/permissions";

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

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canDeleteOrders(user)) {
    return NextResponse.json({ error: "Solo Admin e Ufficio possono eliminare ordini." }, { status: 403 });
  }

  const { id } = await context.params;
  const supabase = getServiceSupabase();

  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ orders: await listOrders() });
}
