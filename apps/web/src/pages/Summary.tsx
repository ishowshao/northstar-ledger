import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { summaryApi } from "../lib/api.js";

const COLORS = ["#2563eb", "#16a34a", "#dc2626", "#d97706", "#8b5cf6", "#06b6d4", "#f43f5e"];

export default function Summary() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [activeTab, setActiveTab] = useState<"overview" | "projects" | "customers" | "cashflow">(
    "overview",
  );

  const { data: monthlyData } = useQuery({
    queryKey: ["summary", "monthly", year],
    queryFn: () => summaryApi.monthly(year),
  });

  const { data: yearlySummary } = useQuery({
    queryKey: ["summary", "yearly", year],
    queryFn: () => summaryApi.yearly(year),
  });

  const { data: projectData } = useQuery({
    queryKey: ["summary", "projects"],
    queryFn: () => summaryApi.projects(),
    enabled: activeTab === "projects",
  });

  const { data: customerData } = useQuery({
    queryKey: ["summary", "customers"],
    queryFn: () => summaryApi.customers(),
    enabled: activeTab === "customers",
  });

  const { data: cashflowData } = useQuery({
    queryKey: ["summary", "cashflow", year],
    queryFn: () => summaryApi.cashflow(year),
    enabled: activeTab === "cashflow",
  });

  const barData =
    monthlyData?.map((m) => ({
      name: `${m.month}月`,
      income: m.income / 100,
      expense: m.expense / 100,
      net: m.net / 100,
    })) ?? [];

  const cashflowChartData =
    cashflowData?.map((f: any) => ({
      name: f.period.slice(5),
      inflow: f.inflow / 100,
      outflow: f.outflow / 100,
      balance: f.endingBalance / 100,
    })) ?? [];

  const projectChartData =
    projectData?.map((p: any) => ({
      name: p.projectName,
      profit: p.netProfit / 100,
      invoiced: p.invoicedAmount / 100,
    })) ?? [];

  const customerPieData =
    customerData?.map((c: any) => ({
      name: c.customerName,
      value: c.netRevenue / 100,
    })) ?? [];

  return (
    <div>
      <div className="page-header">
        <h2>经营汇总</h2>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map((y) => (
            <option key={y} value={y}>
              {y}年
            </option>
          ))}
        </select>
      </div>

      {/* Tab Navigation */}
      <div className="tabs" style={{ marginBottom: "1.5rem" }}>
        {[
          { key: "overview" as const, label: "总览" },
          { key: "projects" as const, label: "项目盈利" },
          { key: "customers" as const, label: "客户收入" },
          { key: "cashflow" as const, label: "现金流" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`tab ${activeTab === tab.key ? "tab-active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <>
          {yearlySummary && (
            <div className="summary-cards">
              <div className="summary-card">
                <h4>总收入</h4>
                <p className="positive">{(yearlySummary.totalIncome / 100).toFixed(2)}</p>
              </div>
              <div className="summary-card">
                <h4>总支出</h4>
                <p className="negative">{(yearlySummary.totalExpense / 100).toFixed(2)}</p>
              </div>
              <div className="summary-card">
                <h4>净结余</h4>
                <p className={yearlySummary.netIncome >= 0 ? "positive" : "negative"}>
                  {(yearlySummary.netIncome / 100).toFixed(2)}
                </p>
              </div>
              <div className="summary-card">
                <h4>交易数</h4>
                <p>{yearlySummary.txCount}</p>
              </div>
            </div>
          )}

          {barData.length > 0 && (
            <div className="card" style={{ marginBottom: "1.5rem", padding: "1rem" }}>
              <h4 style={{ marginBottom: "1rem" }}>月度收支趋势</h4>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => value.toFixed(2)} />
                  <Legend />
                  <Bar dataKey="income" fill="#16a34a" name="收入" />
                  <Bar dataKey="expense" fill="#dc2626" name="支出" />
                </BarChart>
              </ResponsiveContainer>
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
                    <td className="positive">{(s.income / 100).toFixed(2)}</td>
                    <td className="negative">{(s.expense / 100).toFixed(2)}</td>
                    <td className={s.net >= 0 ? "positive" : "negative"}>
                      {(s.net / 100).toFixed(2)}
                    </td>
                    <td>{s.txCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty-state">该年度暂无数据</p>
          )}
        </>
      )}

      {/* Projects Tab */}
      {activeTab === "projects" && (
        <>
          {projectChartData.length > 0 && (
            <div className="card" style={{ marginBottom: "1.5rem", padding: "1rem" }}>
              <h4 style={{ marginBottom: "1rem" }}>项目利润分析</h4>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={projectChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => value.toFixed(2)} />
                  <Legend />
                  <Bar dataKey="profit" fill="#2563eb" name="净利润" />
                  <Bar dataKey="invoiced" fill="#16a34a" name="发票金额" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {projectData && projectData.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>项目</th>
                  <th>收入</th>
                  <th>支出</th>
                  <th>净利润</th>
                  <th>发票金额</th>
                  <th>交易数</th>
                </tr>
              </thead>
              <tbody>
                {projectData.map((p: any) => (
                  <tr key={p.projectId}>
                    <td>{p.projectName}</td>
                    <td className="positive">{(p.totalIncome / 100).toFixed(2)}</td>
                    <td className="negative">{(p.totalExpense / 100).toFixed(2)}</td>
                    <td className={p.netProfit >= 0 ? "positive" : "negative"}>
                      {(p.netProfit / 100).toFixed(2)}
                    </td>
                    <td>{(p.invoicedAmount / 100).toFixed(2)}</td>
                    <td>{p.txCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty-state">暂无项目数据</p>
          )}
        </>
      )}

      {/* Customers Tab */}
      {activeTab === "customers" && (
        <>
          {customerPieData.length > 0 && (
            <div className="card" style={{ marginBottom: "1.5rem", padding: "1rem" }}>
              <h4 style={{ marginBottom: "1rem" }}>客户收入分布</h4>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={customerPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, value }) => `${name} ${value.toFixed(0)}`}
                  >
                    {customerPieData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={COLORS[customerPieData.indexOf(entry) % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => value.toFixed(2)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {customerData && customerData.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>客户</th>
                  <th>收入</th>
                  <th>支出</th>
                  <th>净收入</th>
                  <th>发票数</th>
                  <th>发票总额</th>
                </tr>
              </thead>
              <tbody>
                {customerData.map((c: any) => (
                  <tr key={c.customerId}>
                    <td>{c.customerName}</td>
                    <td className="positive">{(c.totalIncome / 100).toFixed(2)}</td>
                    <td className="negative">{(c.totalExpense / 100).toFixed(2)}</td>
                    <td className={c.netRevenue >= 0 ? "positive" : "negative"}>
                      {(c.netRevenue / 100).toFixed(2)}
                    </td>
                    <td>{c.invoiceCount}</td>
                    <td>{(c.invoiceTotal / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty-state">暂无客户数据</p>
          )}
        </>
      )}

      {/* Cashflow Tab */}
      {activeTab === "cashflow" && (
        <>
          {cashflowChartData.length > 0 && (
            <div className="card" style={{ marginBottom: "1.5rem", padding: "1rem" }}>
              <h4 style={{ marginBottom: "1rem" }}>现金流趋势</h4>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={cashflowChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => value.toFixed(2)} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="inflow"
                    stroke="#16a34a"
                    name="流入"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="outflow"
                    stroke="#dc2626"
                    name="流出"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="balance"
                    stroke="#2563eb"
                    name="期末余额"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {cashflowData && cashflowData.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>月份</th>
                  <th>流入</th>
                  <th>流出</th>
                  <th>净流量</th>
                  <th>期末余额</th>
                </tr>
              </thead>
              <tbody>
                {cashflowData.map((f: any) => (
                  <tr key={f.period}>
                    <td>{f.period}</td>
                    <td className="positive">{(f.inflow / 100).toFixed(2)}</td>
                    <td className="negative">{(f.outflow / 100).toFixed(2)}</td>
                    <td className={f.netFlow >= 0 ? "positive" : "negative"}>
                      {(f.netFlow / 100).toFixed(2)}
                    </td>
                    <td className={f.endingBalance >= 0 ? "positive" : "negative"}>
                      {(f.endingBalance / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty-state">暂无现金流数据</p>
          )}
        </>
      )}
    </div>
  );
}
