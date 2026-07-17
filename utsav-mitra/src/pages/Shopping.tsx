import { useOutletContext } from "react-router-dom";
import { useEffect, useState } from "react";
import { addShoppingItem, getShopping, updateShoppingItem } from "@/firebase/events";
import type { ShoppingItem } from "@/types";

export default function Shopping() {
  const { eventId } = useOutletContext<{ eventId: string }>();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);
  const [cost, setCost] = useState(0);

  async function load() {
    setItems(await getShopping(eventId));
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function add() {
    if (!name.trim()) return;
    await addShoppingItem(eventId, { name: name.trim(), quantity: qty, estimatedCost: cost, bought: false });
    setName("");
    setQty(1);
    setCost(0);
    load();
  }

  async function toggle(it: ShoppingItem) {
    await updateShoppingItem(eventId, it.id, { bought: !it.bought });
    load();
  }

  return (
    <div className="space-y-4 p-4 pb-24">
      <h1 className="text-xl font-bold">Shopping</h1>
      <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
        <input className="w-full rounded-lg bg-surface-2 border border-border p-2 text-text" placeholder="Item name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex gap-2">
          <input type="number" className="flex-1 rounded-lg bg-surface-2 border border-border p-2 text-text" placeholder="Qty" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          <input type="number" className="flex-1 rounded-lg bg-surface-2 border border-border p-2 text-text" placeholder="Est ₹" value={cost} onChange={(e) => setCost(Number(e.target.value))} />
        </div>
        <button onClick={add} className="w-full rounded-lg bg-primary p-2 font-semibold text-black">Add Item</button>
      </div>

      <div className="space-y-2">
        {items.map((it) => (
          <label key={it.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
            <input type="checkbox" checked={it.bought} onChange={() => toggle(it)} />
            <div className="flex-1">
              <div className={it.bought ? "line-through text-text-dim" : ""}>{it.name}</div>
              <div className="text-xs text-text-dim">x{it.quantity} · ₹{it.estimatedCost}</div>
            </div>
          </label>
        ))}
        {items.length === 0 && <p className="text-text-dim">Nothing in the list yet.</p>}
      </div>
    </div>
  );
}
