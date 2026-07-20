export type UserRole = "superAdmin" | "member";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  ownedEventIds: string[];
  memberOfEventIds: string[];
  createdAt: number;
}

export type EventMemberRole = "owner" | "treasurer" | "member";

export interface EventMember {
  uid: string;
  name: string;
  role: EventMemberRole;
}

export type TemplateKind = "ganpati" | "custom" | "generic";

export interface EventDoc {
  id: string;
  title: string;
  description?: string;
  templateKind: TemplateKind;
  startDate?: string;
  endDate?: string;
  createdBy: string;
  createdAt: number;
  totalBudget: number;
  members: EventMember[];
  memberUids: string[];
  isRecurringCopy?: boolean;
}

export type SplitEntry = { uid: string; name: string; amount: number; paid: boolean };

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  paidBy: string;
  date: number;
  note?: string;
  splitMode: "equal" | "custom";
  split: SplitEntry[];
  receiptUrl?: string;
}

export type TaskStatus = "pending" | "in-progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  description?: string;
  assignedTo?: string;
  deadline?: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: number;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  estimatedCost: number;
  bought: boolean;
  buyerUid?: string;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  createdBy: string;
  createdAt: number;
}

export interface GalleryPhoto {
  id: string;
  url: string;
  caption?: string;
  uploadedBy: string;
  createdAt: number;
}

export interface TemplateItem {
  task?: { title: string; description?: string; priority?: TaskPriority };
  shopping?: { name: string; quantity: number; estimatedCost: number };
}

export interface EventTemplate {
  id: string;
  title: string;
  kind: "ganpati" | "custom" | "generic";
  ownerUid: string;
  ownerName: string;
  featured: boolean;
  items: TemplateItem[];
  createdAt: number;
}
