
"use client";

import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";

type Role = "admin" | "ufficio" | "agente" | "laboratorio";
type User = { id: string; username: string; fullName: string; role: Role; isActive?: boolean };
type Product = { id: string; sku: string; name: string; category: string; is_active: boolean };
type OrderLine = {
  id?: string;
  productId: string;
  skuSnapshot: string;
  productNameSnapshot: string;
  categorySnapshot: string;
  quantity: number | string;
};
type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  priority: "Alta" | "Media" | "Bassa";
  notes: string;
  status: "ORDINE DA LAVORARE" | "ORDINE IN LAVORAZIONE" | "ORDINE PRONTO";
  createdByName: string;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  categoryLock?: string | null;
  lines: OrderLine[];
};

type DraftLine = {
  id: string;
  categoryFilter: string;
  search: string;
  selectedProductId: string;
  quantity: string;
};

const STATUS = {
  TODO: "ORDINE DA LAVORARE",
  WORKING: "ORDINE IN LAVORAZIONE",
  READY: "ORDINE PRONTO"
} as const;

function uid() {
  return crypto.randomUUID();
}

function emptyLine(): DraftLine {
  return {
    id: uid(),
    categoryFilter: "ALL",
    search: "",
    selectedProductId: "",
    quantity: ""
  };
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("it-IT");
}

function formatDuration(ms: number) {
  if (!ms || ms < 0) return "-";
  const mins = Math.round(ms / 60000);
  const d = Math.floor(mins / (60 * 24));
  const h = Math.floor((mins % (60 * 24)) / 60);
  const m = mins % 60;
  const out = [];
  if (d) out.push(`${d}g`);
  if (h) out.push(`${h}h`);
  if (m || out.length === 0) out.push(`${m}m`);
  return out.join(" ");
}

function avg(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function sumQty(lines: { quantity: number | string }[]) {
  return lines.reduce((a, l) => a + Number(l.quantity || 0), 0);
}

function priorityRank(value?: string) {
  if (value === "Alta") return 0;
  if (value === "Media") return 1;
  if (value === "Bassa") return 2;
  return 9;
}

export default function DashboardPage() {
  const [me, setMe] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<"orders" | "new" | "stats" | "admin">("orders");
  const [searchOrders, setSearchOrders] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [customerName, setCustomerName] = useState("");
  const [priority, setPriority] = useState<"Alta" | "Media" | "Bassa">("Media");
  const [orderNotes, setOrderNotes] = useState("");
  const [draftLines, setDraftLines] = useState<DraftLine[]>([emptyLine()]);
  const [newSku, setNewSku] = useState("");
  const [newProductName, setNewProductName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newUser, setNewUser] = useState({ username: "", fullName: "", password: "", role: "agente" as Role });
  const [message, setMessage] = useState("");

  const canManageProducts = me?.role === "admin" || me?.role === "ufficio";
  const canManageUsers = me?.role === "admin";
  const canDeleteOrders = me?.role === "admin" || me?.role === "ufficio";

  async function loadAll() {
    const meRes = await fetch("/api/auth/me");
    if (meRes.status === 401) {
      window.location.href = "/login";
      return;
    }
    const meData = await meRes.json();
    setMe(meData.user);

    const [productsRes, ordersRes] = await Promise.all([
      fetch("/api/products"),
      fetch("/api/orders")
    ]);

    setProducts((await productsRes.json()).products || []);
    setOrders((await ordersRes.json()).orders || []);

    if (meData.user.role === "admin") {
      const usersRes = await fetch("/api/users");
      setUsers((await usersRes.json()).users || []);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (me?.role === "admin") {
      fetch("/api/users").then((r) => r.json()).then((d) => setUsers(d.users || []));
    }
  }, [me]);

  const categories = useMemo(() => {
    return [...new Set(products.filter((p) => p.is_active).map((p) => p.category))].sort();
  }, [products]);

  function selectedProductIdsExcluding(lineId: string) {
    return new Set(
      draftLines.filter((l) => l.id !== lineId && l.selectedProductId).map((l) => l.selectedProductId)
    );
  }

  function selectedProduct(line: DraftLine) {
    return products.find((p) => p.id === line.selectedProductId);
  }

  function lockedOrderCategory() {
    for (const line of draftLines) {
      const p = products.find((prod) => prod.id === line.selectedProductId);
      if (p?.category) return p.category;
    }
    return "";
  }

  function filteredProductsForLine(line: DraftLine) {
    let list = products.filter((p) => p.is_active);
    const used = selectedProductIdsExcluding(line.id);
    const lockedCategory = lockedOrderCategory();

    list = list.filter((p) => !used.has(p.id) || p.id === line.selectedProductId);

    if (lockedCategory) {
      list = list.filter((p) => p.category === lockedCategory || p.id === line.selectedProductId);
    } else if (line.categoryFilter !== "ALL") {
      list = list.filter((p) => p.category === line.categoryFilter);
    }

    const q = line.search.trim().toLowerCase();
    if (q) list = list.filter((p) => p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
    return list;
  }

  const visibleOrders = useMemo(() => {
    const q = searchOrders.trim().toLowerCase();
    return [...orders]
      .filter((o) => {
        const statusOk = statusFilter === "ALL" || o.status === statusFilter;
        const hay = [
          o.orderNumber,
          o.customerName,
          o.priority,
          ...o.lines.map((l) => `${l.skuSnapshot} ${l.productNameSnapshot} ${l.categorySnapshot}`)
        ].join(" ").toLowerCase();

        return statusOk && (!q || hay.includes(q));
      })
      .sort((a, b) => {
        const pr = priorityRank(a.priority) - priorityRank(b.priority);
        if (pr !== 0) return pr;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [orders, searchOrders, statusFilter]);

  const stats = useMemo(() => {
    const started = orders.filter((o) => o.startedAt);
    const completed = orders.filter((o) => o.startedAt && o.completedAt);

    const waiting = avg(started.map((o) => new Date(o.startedAt!).getTime() - new Date(o.createdAt).getTime()));
    const working = avg(completed.map((o) => new Date(o.completedAt!).getTime() - new Date(o.startedAt!).getTime()));
    const total = avg(completed.map((o) => new Date(o.completedAt!).getTime() - new Date(o.createdAt).getTime()));

    const last7 = new Date();
    last7.setDate(last7.getDate() - 7);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const productMap = new Map<string, { qty: number; label: string }>();
    orders.forEach((o) => {
      o.lines.forEach((l) => {
        const key = `${l.skuSnapshot}|${l.productNameSnapshot}`;
        const cur = productMap.get(key) || { qty: 0, label: `${l.skuSnapshot} - ${l.productNameSnapshot}` };
        cur.qty += Number(l.quantity || 0);
        productMap.set(key, cur);
      });
    });

    return {
      todo: orders.filter((o) => o.status === STATUS.TODO).length,
      working: orders.filter((o) => o.status === STATUS.WORKING).length,
      ready: orders.filter((o) => o.status === STATUS.READY).length,
      totalOrders: orders.length,
      waiting,
      workingAvg: working,
      total,
      completedLast7: orders.filter((o) => o.completedAt && new Date(o.completedAt) >= last7).length,
      completedThisMonth: orders.filter((o) => o.completedAt && new Date(o.completedAt) >= monthStart).length,
      topProducts: [...productMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 5)
    };
  }, [orders]);

  function setLineField(id: string, field: keyof DraftLine, value: string) {
    setDraftLines((prev) => prev.map((line) => (line.id === id ? { ...line, [field]: value } : line)));
  }

  function updateLine(id: string, field: keyof DraftLine, value: string) {
    setDraftLines((prev) =>
      prev.map((line) =>
        line.id === id
          ? {
              ...line,
              [field]: value,
              ...(field === "categoryFilter" ? { search: "", selectedProductId: "" } : {})
            }
          : line
      )
    );
  }

  function addLine() {
    setDraftLines((prev) => [emptyLine(), ...prev]);
  }

  function removeLine(id: string) {
    setDraftLines((prev) => {
      const next = prev.filter((line) => line.id !== id);
      return next.length ? next : [emptyLine()];
    });
  }

  async function createProduct() {
    if (!canManageProducts) return;
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku: newSku, name: newProductName, category: newCategory })
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error || "Errore creazione prodotto.");
    setNewSku(""); setNewProductName(""); setNewCategory("");
    setProducts(data.products);
    setMessage("Prodotto creato.");
  }

  async function toggleProduct(id: string) {
    if (!canManageProducts) return;
    const res = await fetch(`/api/products/${id}/toggle`, { method: "PATCH" });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error || "Errore aggiornamento prodotto.");
    setProducts(data.products);
  }

  async function createUser() {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser)
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error || "Errore creazione utente.");
    setUsers(data.users);
    setNewUser({ username: "", fullName: "", password: "", role: "agente" });
    setMessage("Utente creato.");
  }

  async function toggleUser(id: string) {
    const res = await fetch(`/api/users/${id}/toggle`, { method: "PATCH" });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error || "Errore aggiornamento utente.");
    setUsers(data.users);
  }

  async function saveOrder() {
    if (!customerName.trim()) return setMessage("Inserisci il cliente.");

    const lines: OrderLine[] = [];
    const seen = new Set<string>();
    let orderCategory = "";

    for (const line of draftLines) {
      const product = selectedProduct(line);
      if (!product || !line.quantity || Number(line.quantity) <= 0) {
        return setMessage("Completa tutte le righe con prodotto e quantità valida.");
      }
      if (seen.has(product.id)) {
        return setMessage("Non puoi inserire lo stesso prodotto in più righe.");
      }
      if (!orderCategory) {
        orderCategory = product.category;
      } else if (product.category !== orderCategory) {
        return setMessage("Tutti i prodotti dell'ordine devono avere la stessa categoria del primo.");
      }

      seen.add(product.id);
      lines.push({
        productId: product.id,
        skuSnapshot: product.sku,
        productNameSnapshot: product.name,
        categorySnapshot: product.category,
        quantity: Number(line.quantity)
      });
    }

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerName, priority, notes: orderNotes, categoryLock: orderCategory, lines })
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error || "Errore salvataggio ordine.");

    setOrders(data.orders);
    setCustomerName("");
    setPriority("Media");
    setOrderNotes("");
    setDraftLines([emptyLine()]);
    setActiveTab("orders");
    setMessage("Ordine salvato.");
  }

  async function updateOrderStatus(id: string, status: Order["status"]) {
    const res = await fetch(`/api/orders/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error || "Errore aggiornamento stato.");
    setOrders(data.orders);
  }

  async function deleteOrder(id: string) {
    if (!canDeleteOrders) return;
    const ok = window.confirm("Vuoi eliminare questo ordine?");
    if (!ok) return;

    const res = await fetch(`/api/orders/${id}`, {
      method: "DELETE"
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error || "Errore eliminazione ordine.");
    setOrders(data.orders);
    setMessage("Ordine eliminato.");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  function makeOrderPdf(order: Order) {
    const doc = new jsPDF();
    let y = 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("ORDINE DI LAVORAZIONE", 14, y); y += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Numero ordine: ${order.orderNumber}`, 14, y); y += 7;
    doc.text(`Data inserimento: ${formatDate(order.createdAt)}`, 14, y); y += 7;
    doc.text(`Creato da: ${order.createdByName}`, 14, y); y += 7;
    doc.text(`Stato: ${order.status}`, 14, y); y += 7;
    doc.text(`Priorità: ${order.priority}`, 14, y); y += 10;
    doc.setFont("helvetica", "bold");
    doc.text("Cliente", 14, y); y += 6;
    doc.setFont("helvetica", "normal");
    doc.text(order.customerName, 14, y); y += 10;

    doc.setFont("helvetica", "bold");
    doc.text("Righe ordine", 14, y); y += 6;
    doc.line(14, y, 196, y); y += 6;
    doc.text("Referenza / SKU", 14, y);
    doc.text("Categoria", 55, y);
    doc.text("Nome prodotto", 90, y);
    doc.text("Quantità", 175, y);
    y += 4;
    doc.line(14, y, 196, y); y += 8;
    doc.setFont("helvetica", "normal");

    order.lines.forEach((line) => {
      const splitName = doc.splitTextToSize(String(line.productNameSnapshot), 78);
      const rowHeight = Math.max(8, splitName.length * 6);
      if (y + rowHeight > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(String(line.skuSnapshot), 14, y);
      doc.text(String(line.categorySnapshot), 55, y);
      doc.text(splitName, 90, y);
      doc.text(String(line.quantity), 175, y);
      y += rowHeight;
    });

    y += 8;
    doc.text(`Quantità totale: ${sumQty(order.lines)}`, 14, y); y += 10;
    if (order.notes) {
      doc.setFont("helvetica", "bold");
      doc.text("Note", 14, y); y += 6;
      doc.setFont("helvetica", "normal");
      doc.text(doc.splitTextToSize(order.notes, 180), 14, y);
    }
    doc.save(`${order.orderNumber}_ordine.pdf`);
  }

  function makeBollaPdf(order: Order) {
    const doc = new jsPDF();
    let y = 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("BOLLA ORDINE PRONTO", 14, y); y += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Numero ordine: ${order.orderNumber}`, 14, y); y += 7;
    doc.text(`Data ordine: ${formatDate(order.createdAt)}`, 14, y); y += 7;
    doc.text(`Data completamento: ${formatDate(order.completedAt)}`, 14, y); y += 7;
    doc.text(`Priorità: ${order.priority}`, 14, y); y += 11;
    doc.setFont("helvetica", "bold");
    doc.text("Cliente", 14, y); y += 6;
    doc.setFont("helvetica", "normal");
    doc.text(order.customerName, 14, y); y += 10;

    doc.setFont("helvetica", "bold");
    doc.text("Dettaglio prodotto", 14, y); y += 6;
    doc.line(14, y, 196, y); y += 6;
    doc.text("Referenza / SKU", 14, y);
    doc.text("Nome prodotto", 72, y);
    doc.text("Quantità", 170, y);
    y += 4;
    doc.line(14, y, 196, y); y += 8;
    doc.setFont("helvetica", "normal");

    order.lines.forEach((line) => {
      const splitName = doc.splitTextToSize(String(line.productNameSnapshot), 90);
      const rowHeight = Math.max(8, splitName.length * 6);
      if (y + rowHeight > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(String(line.skuSnapshot), 14, y);
      doc.text(splitName, 72, y);
      doc.text(String(line.quantity), 170, y);
      y += rowHeight;
    });

    if (order.notes) {
      y += 8;
      doc.setFont("helvetica", "bold");
      doc.text("Note", 14, y); y += 6;
      doc.setFont("helvetica", "normal");
      doc.text(doc.splitTextToSize(order.notes, 180), 14, y);
    }

    doc.save(`${order.orderNumber}_bolla.pdf`);
  }

  if (!me) return <div className="container">Caricamento...</div>;

  return (
    <div className="container">
      <div className="header card">
        <div>
          <div className="title">Ordini Laboratorio Online</div>
          <div className="subtitle">Utente: {me.fullName} · {me.username} · {me.role}</div>
        </div>
        <div>
          <button onClick={logout}>Esci</button>
        </div>
      </div>

      {message ? <div className="notice" style={{ marginBottom: 14 }}>{message}</div> : null}

      <div className="tabs">
        <button className={`tab ${activeTab === "orders" ? "active" : ""}`} onClick={() => setActiveTab("orders")}>Ordini</button>
        <button className={`tab ${activeTab === "new" ? "active" : ""}`} onClick={() => setActiveTab("new")}>Nuovo ordine</button>
        <button className={`tab ${activeTab === "stats" ? "active" : ""}`} onClick={() => setActiveTab("stats")}>Statistiche</button>
        {canManageUsers ? <button className={`tab ${activeTab === "admin" ? "active" : ""}`} onClick={() => setActiveTab("admin")}>Admin</button> : null}
      </div>

      {activeTab === "orders" ? (
        <div className="grid grid-2">
          <div className="card">
            <div className="row" style={{ marginBottom: 14 }}>
              <div>
                <label>Cerca ordine</label>
                <input value={searchOrders} onChange={(e) => setSearchOrders(e.target.value)} placeholder="Cliente, numero ordine, SKU..." />
              </div>
              <div>
                <label>Stato</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="ALL">Tutti gli stati</option>
                  <option value={STATUS.TODO}>{STATUS.TODO}</option>
                  <option value={STATUS.WORKING}>{STATUS.WORKING}</option>
                  <option value={STATUS.READY}>{STATUS.READY}</option>
                </select>
              </div>
            </div>

            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Ordine</th>
                    <th>Data</th>
                    <th>Cliente</th>
                    <th>Priorità</th>
                    <th>Righe</th>
                    <th>Quantità</th>
                    <th>Stato</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOrders.map((o) => (
                    <tr key={o.id}>
                      <td><strong>{o.orderNumber}</strong></td>
                      <td>{formatDate(o.createdAt)}</td>
                      <td>{o.customerName}</td>
                      <td>
                        <span className={`badge ${o.priority === "Alta" ? "todo" : o.priority === "Media" ? "working" : "ready"}`}>{o.priority}</span>
                      </td>
                      <td>{o.lines.length}</td>
                      <td>{sumQty(o.lines)}</td>
                      <td>
                        <span className={`badge ${o.status === STATUS.TODO ? "todo" : o.status === STATUS.WORKING ? "working" : "ready"}`}>{o.status}</span>
                      </td>
                      <td>
                        <div className="row">
                          {o.status === STATUS.TODO ? <button className="small" onClick={() => updateOrderStatus(o.id, STATUS.WORKING)}>In lavorazione</button> : null}
                          {o.status !== STATUS.READY ? <button className="small" onClick={() => updateOrderStatus(o.id, STATUS.READY)}>Pronto</button> : <button className="small" onClick={() => makeBollaPdf(o)}>Bolla PDF</button>}
                          <button className="small" onClick={() => makeOrderPdf(o)}>Ordine PDF</button>
                          {canDeleteOrders ? <button className="small danger" onClick={() => deleteOrder(o.id)}>Elimina</button> : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!visibleOrders.length ? <tr><td colSpan={8} className="muted">Nessun ordine trovato.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid">
            <div className="kpi"><div className="muted">Da lavorare</div><div className="value">{stats.todo}</div></div>
            <div className="kpi"><div className="muted">In lavorazione</div><div className="value">{stats.working}</div></div>
            <div className="kpi"><div className="muted">Pronti</div><div className="value">{stats.ready}</div></div>
          </div>
        </div>
      ) : null}

      {activeTab === "new" ? (
        <div className="grid grid-2">
          <div className="card">
            <h2>Crea nuovo ordine</h2>
            <div className="row">
              <div>
                <label>Cliente / Ragione sociale</label>
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>
              <div>
                <label>Priorità</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value as "Alta" | "Media" | "Bassa")}>
                  <option value="Alta">Alta</option>
                  <option value="Media">Media</option>
                  <option value="Bassa">Bassa</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <label>Note</label>
              <textarea value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "18px 0 10px" }}>
              <h2 style={{ margin: 0 }}>Righe ordine</h2>
              <button className="secondary" onClick={addLine}>+ Aggiungi riga</button>
            </div>

            <div>
              {draftLines.map((line, idx) => {
                const selected = selectedProduct(line);
                const options = filteredProductsForLine(line);
                const lockedCategory = lockedOrderCategory();

                return (
                  <div key={line.id} className="lineCard">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <strong>Riga {idx + 1}</strong>
                      {draftLines.length > 1 ? <button className="small danger" onClick={() => removeLine(line.id)}>Rimuovi</button> : null}
                    </div>

                    <div className="row">
                      <div>
                        <label>Categoria</label>
                        <select disabled={!!lockedCategory} value={lockedCategory || line.categoryFilter} onChange={(e) => updateLine(line.id, "categoryFilter", e.target.value)}>
                          <option value="ALL">Tutte</option>
                          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <div className="muted" style={{ marginTop: 6 }}>
                          {lockedCategory ? `Categoria bloccata su: ${lockedCategory}` : "La categoria si blocca al primo prodotto selezionato."}
                        </div>
                      </div>

                      <div>
                        <label>Cerca prodotto</label>
                        <div className="row">
                          <input value={line.search} onChange={(e) => setLineField(line.id, "search", e.target.value)} placeholder="SKU o nome prodotto" />
                          <button className="small" type="button">Cerca</button>
                        </div>
                      </div>

                      <div>
                        <label>Quantità</label>
                        <input type="number" min={1} value={line.quantity} onChange={(e) => setLineField(line.id, "quantity", e.target.value)} />
                      </div>
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <label>Prodotto</label>
                      <select value={line.selectedProductId} onChange={(e) => updateLine(line.id, "selectedProductId", e.target.value)}>
                        <option value="">Seleziona prodotto</option>
                        {options.map((p) => <option key={p.id} value={p.id}>{p.sku} - {p.name} ({p.category})</option>)}
                      </select>
                      <div className="muted" style={{ marginTop: 6 }}>
                        {selected ? `Selezionato: ${selected.sku} - ${selected.name}` : "Nessun prodotto selezionato"}
                      </div>
                      <div className="muted">I prodotti già scelti in altre righe non sono più selezionabili.</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button className="primary" onClick={saveOrder}>Salva ordine</button>
          </div>

          <div className="card">
            <h2>Prodotti</h2>
            {!canManageProducts ? <div className="notice" style={{ marginBottom: 12 }}>Solo Admin e Ufficio possono creare o gestire prodotti.</div> : null}
            <div className="row">
              <div>
                <label>SKU / Referenza</label>
                <input disabled={!canManageProducts} value={newSku} onChange={(e) => setNewSku(e.target.value)} />
              </div>
              <div>
                <label>Categoria</label>
                <input disabled={!canManageProducts} value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label>Nome prodotto</label>
              <input disabled={!canManageProducts} value={newProductName} onChange={(e) => setNewProductName(e.target.value)} />
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="secondary" onClick={createProduct} disabled={!canManageProducts}>Aggiungi prodotto</button>
            </div>

            <div style={{ marginTop: 16 }}>
              {products.map((p) => (
                <div key={p.id} className="card" style={{ padding: 12, marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div>
                      <div><strong>{p.sku}</strong> · {p.name}</div>
                      <div className="muted">{p.category}</div>
                    </div>
                    <button className="small" disabled={!canManageProducts} onClick={() => toggleProduct(p.id)}>
                      {p.is_active ? "Disattiva" : "Riattiva"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "stats" ? (
        <>
          <div className="grid grid-4">
            <div className="kpi"><div className="muted">Ordini totali</div><div className="value">{stats.totalOrders}</div></div>
            <div className="kpi"><div className="muted">Tempo medio attesa</div><div className="value">{formatDuration(stats.waiting)}</div></div>
            <div className="kpi"><div className="muted">Tempo medio lavorazione</div><div className="value">{formatDuration(stats.workingAvg)}</div></div>
            <div className="kpi"><div className="muted">Tempo medio totale</div><div className="value">{formatDuration(stats.total)}</div></div>
          </div>

          <div className="grid grid-2" style={{ marginTop: 18 }}>
            <div className="card">
              <h2>Produzione recente</h2>
              <div className="kpi" style={{ marginBottom: 12 }}><div className="muted">Ordini completati ultimi 7 giorni</div><div className="value">{stats.completedLast7}</div></div>
              <div className="kpi"><div className="muted">Ordini completati questo mese</div><div className="value">{stats.completedThisMonth}</div></div>
            </div>

            <div className="card">
              <h2>Prodotti più richiesti</h2>
              {stats.topProducts.map((p, i) => (
                <div key={p.label} className="card" style={{ padding: 12, marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div><div className="muted">#{i + 1}</div><strong>{p.label}</strong></div>
                    <div><strong>{p.qty}</strong></div>
                  </div>
                </div>
              ))}
              {!stats.topProducts.length ? <div className="muted">Nessun dato disponibile.</div> : null}
            </div>
          </div>
        </>
      ) : null}

      {activeTab === "admin" && canManageUsers ? (
        <div className="grid grid-2">
          <div className="card">
            <h2>Crea account</h2>
            <div className="row">
              <div>
                <label>Username</label>
                <input value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} />
              </div>
              <div>
                <label>Nome completo</label>
                <input value={newUser.fullName} onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })} />
              </div>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <div>
                <label>Password</label>
                <input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
              </div>
              <div>
                <label>Ruolo</label>
                <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })}>
                  <option value="ufficio">ufficio</option>
                  <option value="agente">agente</option>
                  <option value="laboratorio">laboratorio</option>
                  <option value="admin">admin</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="primary" onClick={createUser}>Crea account</button>
            </div>
          </div>

          <div className="card">
            <h2>Utenti</h2>
            {users.map((u) => (
              <div key={u.id} className="card" style={{ padding: 12, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div>
                    <div><strong>{u.username}</strong> · {u.fullName}</div>
                    <div className="muted">{u.role}</div>
                  </div>
                  <button className="small" onClick={() => toggleUser(u.id)}>{u.isActive ? "Disattiva" : "Riattiva"}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
