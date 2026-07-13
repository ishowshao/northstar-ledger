import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { invoicesApi } from "../lib/api.js";

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  sent: "已发送",
  paid: "已付款",
  overdue: "逾期",
  cancelled: "已取消",
};

const STATUS_CLASSES: Record<string, string> = {
  draft: "status-draft",
  sent: "status-sent",
  paid: "status-paid",
  overdue: "status-overdue",
  cancelled: "status-cancelled",
};

export default function Invoices() {
  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: invoicesApi.list,
  });

  if (isLoading) return <div>加载中...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>发票</h2>
        <Link to="/invoices/new" className="btn btn-primary">
          新建发票
        </Link>
      </div>
      {invoices && invoices.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>编号</th>
              <th>状态</th>
              <th>金额</th>
              <th>开票日期</th>
              <th>到期日期</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td>
                  <Link to={`/invoices/${inv.id}`}>{inv.number}</Link>
                </td>
                <td>
                  <span className={`status-badge ${STATUS_CLASSES[inv.status] ?? ""}`}>
                    {STATUS_LABELS[inv.status] ?? inv.status}
                  </span>
                </td>
                <td className={inv.status === "paid" ? "positive" : ""}>
                  {(inv.totalAmount / 100).toFixed(2)} {inv.currency}
                </td>
                <td>{inv.issueDate}</td>
                <td>{inv.dueDate}</td>
                <td>
                  <Link to={`/invoices/${inv.id}`} className="btn btn-sm">
                    查看
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty-state">
          暂无发票，<Link to="/invoices/new">创建第一张发票</Link>
        </p>
      )}
    </div>
  );
}
