import type { Expense } from "@/types";

export interface SettlementTx {
  from: string;
  to: string;
  amount: number;
}

// Net balance per member: positive = owed to them, negative = they owe.
export function computeBalances(expenses: Expense[]): Map<string, number> {
  const bal = new Map<string, number>();
  const add = (uid: string, amt: number) => bal.set(uid, (bal.get(uid) ?? 0) + amt);

  for (const e of expenses) {
    add(e.paidBy, e.amount);
    for (const s of e.split) add(s.uid, -s.amount);
  }
  return bal;
}

// Minimal cash-flow settlement: greedily match largest debtor with largest creditor.
export function computeSettlement(expenses: Expense[]): SettlementTx[] {
  const bal = computeBalances(expenses);
  const creditors = [...bal.entries()].filter(([, v]) => v > 0.01).map(([u, v]) => ({ u, v }));
  const debtors = [...bal.entries()].filter(([, v]) => v < -0.01).map(([u, v]) => ({ u, v: -v }));

  creditors.sort((a, b) => b.v - a.v);
  debtors.sort((a, b) => b.v - a.v);

  const txs: SettlementTx[] = [];
  let i = 0;
  let j = 0;
  while (i < creditors.length && j < debtors.length) {
    const pay = Math.min(creditors[i].v, debtors[j].v);
    txs.push({ from: debtors[j].u, to: creditors[i].u, amount: Math.round(pay * 100) / 100 });
    creditors[i].v -= pay;
    debtors[j].v -= pay;
    if (creditors[i].v <= 0.01) i++;
    if (debtors[j].v <= 0.01) j++;
  }
  return txs;
}

export function netForMember(expenses: Expense[], uid: string): number {
  return computeBalances(expenses).get(uid) ?? 0;
}
