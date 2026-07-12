import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { summaryApi } from "../lib/api.js";

export default function Summary() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());

  const { data: monthlyData } = useQuery({
    queryKey: ["summary", "monthly", year],
    queryFn: () => summaryApi.monthly(year),
  });

  const { data: yearlySummary } = useQuery({
    queryKey: ["summary", "yearly", year],
    queryFn: () => summaryApi.yearly(year),
  });

  return (
    <div>
      <div className="page-header">
        <h2>经营汇总</h2>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {yearlySummary && (
        <div className="summary-cards">
          <div className="summary-card">
            <h4>总收入</h4>
            <p className="positive">{yearlySummary.totalIncome}</p>
          </div>
          <div className="summary-card">
            <h4>总支出</h4>
            <p className="negative">{yearlySummary.totalExpense}</p>
          </div>
          <div className="summary-card">
            <h4>净结余</h4>
            <p className={yearlySummary.netIncome >= 0 ? "positive" : "negative"}>
              {yearlySummary.netIncome}
            </p>
          </div>
          <div className="summary-card">
            <h4>交易数</h4>
            <p>{yearlySummary.txCount}</p>
          </div>
        </div>
      )}

      <h3>月度明细</h3>
      {monthlyData && monthlyData.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>月份</th>
              <th>收入</th>
              <th>支出</th>
              <th>净结余</th>
              <th>交易数</th>
            </tr>
          </thead>
          <tbody>
            {monthlyData.map((s) => (
              <tr key={`${s.year}-${s.month}`}>
                <td>
                  {s.year}-{String(s.month).padStart(2, "0")}
                </td>
                <td className="positive">{s.income}</td>
                <td className="negative">{s.expense}</td>
                <td className={s.net >= 0 ? "positive" : "negative"}>{s.net}</td>
                <td>{s.txCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty-state">该年度暂无数据</p>
      )}
    </div>
  );
}
