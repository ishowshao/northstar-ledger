const BASE_URL = "/api/v1";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

// ── Accounts ──

export interface Account {
  id: string;
  name: string;
  type: "cash" | "bank" | "credit" | "investment" | "other";
  currency: string;
  balance: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountInput {
  name: string;
  type?: string;
  currency?: string;
  description?: string;
}

export const accountsApi = {
  list: () => request<{ data: Account[] }>("/accounts").then((r) => r.data),
  get: (id: string) => request<{ data: Account }>(`/accounts/${id}`).then((r) => r.data),
  create: (input: CreateAccountInput) =>
    request<{ data: Account }>("/accounts", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.data),
};

// ── Customers ──

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerInput {
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export const customersApi = {
  list: () => request<{ data: Customer[] }>("/customers").then((r) => r.data),
  create: (input: CreateCustomerInput) =>
    request<{ data: Customer }>("/customers", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.data),
  delete: (id: string) => request<{ success: boolean }>(`/customers/${id}`, { method: "DELETE" }),
};

// ── Projects ──

export interface Project {
  id: string;
  name: string;
  description: string | null;
  customerId: string | null;
  status: "active" | "completed" | "cancelled";
  hourlyRate: number | null;
  currency: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  status?: string;
  customerId?: string;
}

export const projectsApi = {
  list: () => request<{ data: Project[] }>("/projects").then((r) => r.data),
  create: (input: CreateProjectInput) =>
    request<{ data: Project }>("/projects", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.data),
  delete: (id: string) => request<{ success: boolean }>(`/projects/${id}`, { method: "DELETE" }),
};

// ── Transactions ──

export interface Transaction {
  id: string;
  accountId: string;
  customerId: string | null;
  projectId: string | null;
  type: "income" | "expense" | "transfer";
  status: string;
  amount: number;
  currency: string;
  description: string | null;
  category: string | null;
  date: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransactionInput {
  accountId: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  currency?: string;
  description?: string;
  category?: string;
  date?: string;
  customerId?: string;
  projectId?: string;
  note?: string;
}

export interface TransactionFilters {
  accountId?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export const transactionsApi = {
  list: (filters?: TransactionFilters) => {
    const params = new URLSearchParams();
    if (filters?.accountId) params.set("accountId", filters.accountId);
    if (filters?.type) params.set("type", filters.type);
    if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters?.dateTo) params.set("dateTo", filters.dateTo);
    if (filters?.limit) params.set("limit", String(filters.limit));
    if (filters?.offset) params.set("offset", String(filters.offset));
    const qs = params.toString();
    return request<{ data: Transaction[]; meta: { total: number } }>(
      `/transactions${qs ? `?${qs}` : ""}`,
    );
  },
  create: (input: CreateTransactionInput) =>
    request<{ data: Transaction }>("/transactions", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.data),
  delete: (id: string) =>
    request<{ success: boolean }>(`/transactions/${id}`, { method: "DELETE" }),
};

// ── Summary ──

export interface MonthlySummary {
  year: number;
  month: number;
  income: number;
  expense: number;
  net: number;
  txCount: number;
}

export interface PeriodSummary {
  totalIncome: number;
  totalExpense: number;
  netIncome: number;
  txCount: number;
}

export const summaryApi = {
  monthly: (year: number, month?: number) => {
    const params = new URLSearchParams({ year: String(year) });
    if (month) params.set("month", String(month));
    return request<{ data: MonthlySummary[] }>(`/summary/monthly?${params}`).then((r) => r.data);
  },
  yearly: (year: number) =>
    request<{ data: PeriodSummary }>(`/summary/yearly?year=${year}`).then((r) => r.data),
};
