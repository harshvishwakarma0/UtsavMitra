import { useOutletContext } from "react-router-dom";
import { useEffect, useState } from "react";
import { addShoppingItem, deleteShoppingItem, getShopping, updateShoppingItem } from "@/firebase/events";
import type { ShoppingItem } from "@/types";

export default function Shopping() {
  const { eventId } = useOutletContext<{ eventId: string }>();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);
  const [cost, setCost] = useState(0);
  const [filter, setFilter] = useState<"all" | "pending" | "bought">("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    try {
      setLoading(true);
      setItems(await getShopping(eventId));
    } catch (e: any) {
      console.error("Failed to load shopping list:", e);
      setErr("Failed to load shopping items.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    setErr("");
    try {
      await addShoppingItem(eventId, {
        name: name.trim(),
        quantity: Math.max(1, qty),
        estimatedCost: Math.max(0, cost),
        bought: false,
      });
      setName("");
      setQty(1);
      setCost(0);
      await load();
    } catch (e: any) {
      console.error("Failed to add shopping item:", e);
      setErr(e?.message ?? "Failed to add item.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(it: ShoppingItem) {
    try {
      await updateShoppingItem(eventId, it.id, { bought: !it.bought });
      await load();
    } catch (e: any) {
      console.error("Failed to update item:", e);
      setErr("Failed to update item status.");
    }
  }

  async function handleDelete(itemId: string, e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm("Delete this shopping item?")) return;
    try {
      await deleteShoppingItem(eventId, itemId);
      await load();
    } catch (e: any) {
      console.error("Failed to delete item:", e);
      setErr("Failed to delete item.");
    }
  }

  const totalEst = items.reduce((sum, i) => sum + i.estimatedCost * i.quantity, 0);
  const boughtEst = items.filter((i) => i.bought).reduce((sum, i) => sum + i.estimatedCost * i.quantity, 0);

  const filteredItems = items.filter((i) => {
    if (filter === "pending") return !i.bought;
    if (filter === "bought") return i.bought;
    return true;
  });

  return (
    <div className="space-y-4 p-4 pb-24">
      <h1 className="text-xl font-bold">Shopping List</h1>

      {err && <div className="rounded-lg bg-surface-2 p-3 text-sm text-danger">{err}</div>}

      {/* Summary Card */}
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface p-3">
        <div>
          <div className="text-xs text-text-dim">Est. Total</div>
          <div className="text-lg font-bold text-primary">₹{totalEst}</div>
        </div>
        <div>
          <div className="text-xs text-text-dim">Bought Total</div>
          <div className="text-lg font-bold text-text">₹{boughtEst}</div>
        </div>
      </div>

      {/* Add Form */}
      <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
        <input
          className="w-full rounded-lg bg-surface-2 border border-border p-2 text-text"
          placeholder="Item name (e.g. Flowers)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center rounded-lg border border-border bg-surface-2 p-1">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="px-2 py-1 font-bold text-text-dim hover:text-text"
            >
              -
            </button>
            <input
              type="number"
              min="1"
              className="w-full bg-transparent text-center text-text"
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
            />
            <button onClick={() => setQty((q) => q + 1)} className="px-2 py-1 font-bold text-text-dim hover:text-text">
              +
            </button>
          </div>
          <input
            type="number"
            min="0"
            className="flex-1 rounded-lg bg-surface-2 border border-border p-2 text-text"
            placeholder="Est ₹ per item"
            value={cost || ""}
            onChange={(e) => setCost(Number(e.target.value))}
          />
        </div>
        <button
          onClick={add}
          disabled={busy}
          className="w-full rounded-lg bg-primary p-2 font-semibold text-black disabled:opacity-50"
        >
          {busy ? "Adding..." : "+ Add Item"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(["all", "pending", "bought"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 rounded-lg border p-1.5 text-xs capitalize ${
              filter === f ? "border-primary text-primary font-semibold" : "border-border text-text-dim"
            }`}
          >
            {f === "pending" ? "To Buy" : f}
          </button>
        ))}
      </div>

      {/* List */}
      {loading && items.length === 0 ? (
        <p className="text-center text-sm text-text-dim">Loading shopping list…</p>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((it) => (
            <label key={it.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 cursor-pointer">
              <input type="checkbox" checked={it.bought} onChange={() => toggle(it)} className="h-4 w-4 rounded" />
              <div className="flex-1 min-w-0">
                <div className={`font-medium truncate ${it.bought ? "line-through text-text-dim" : "text-text"}`}>
                  {it.name}
                </div>
                <div className="text-xs text-text-dim">
                  Qty: {it.quantity} · Est: ₹{it.estimatedCost * it.quantity} (₹{it.estimatedCost} each)
                </div>
              </div>
              <button
                onClick={(e) => handleDelete(it.id, e)}
                className="p-1 text-xs text-text-dim hover:text-danger"
                title="Delete item"
              >
                ✕
              </button>
            </label>
          ))}
          {filteredItems.length === 0 && <p className="text-center text-text-dim">No items found.</p>}
        </div>
      )}
    </div>
  );
}
