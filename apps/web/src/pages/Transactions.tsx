import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { accountsApi, transactionsApi } from "../lib/api.js";

export default function Transactions() {
  const [filters, setFilters] = useState<Record<string, string>>({});

  function updateFilter(key: string, value: string) {
    setFilters((prev) => {
      const next = { ...prev };
      if (value) {
        next[key] = value;
      } else {
        delete next[key];
      }
      return next;
    });
  }
  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: accountsApi.list,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["transactions", filters],
    queryFn: () => transactionsApi.list(filters),
  });

  if (isLoading) return <div>加载中...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>交易记录</h2>
        <Link to="/transactions/new" className="btn btn-primary">
          新增交易
        </Link>
      </div>

      <div className="filters">
        <select value={filters.type ?? ""} onChange={(e) => updateFilter("type", e.target.value)}>
          <option value="">全部类型</option>
          <option value="income">收入</option>
          <option value="expense">支出</option>
          <option value="transfer">转账</option>
        </select>
        <select
          value={filters.accountId ?? ""}
          onChange={(e) => updateFilter("accountId", e.target.value)}
        >
          <option value="">全部账户</option>
          {accounts?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          placeholder="开始日期"
          onChange={(e) => updateFilter("dateFrom", e.target.value)}
        />
        <input
          type="date"
          placeholder="结束日期"
          onChange={(e) => updateFilter("dateTo", e.target.value)}
        />
      </div>

      {data && data.data.length > 0 ? (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>类型</th>
                <th>金额</th>
                <th>描述</th>
                <th>分类</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((t) => (
                <tr key={t.id}>
                  <td>{t.date}</td>
                  <td>{t.type === "income" ? "收入" : t.type === "expense" ? "支出" : "转账"}</td>
                  <td className={t.type === "income" ? "positive" : "negative"}>
                    {t.type === "income" ? "+" : "-"}
                    {t.amount}
                  </td>
                  <td>{t.description ?? "-"}</td>
                  <td>{t.category ?? "-"}</td>
                  <td>{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.meta && <p className="meta-info">共 {data.meta.total} 条记录</p>}
        </>
      ) : (
        <p className="empty-state">暂无交易记录</p>
      )}
    </div>
  );
}
