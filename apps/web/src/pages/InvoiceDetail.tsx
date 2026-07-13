import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { invoicesApi } from "../lib/api.js";

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  sent: "已发送",
  paid: "已付款",
  overdue: "逾期",
  cancelled: "已取消",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "#d97706",
  sent: "#2563eb",
  paid: "#16a34a",
  overdue: "#dc2626",
  cancelled: "#64748b",
};

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => invoicesApi.get(id!),
    enabled: !!id,
  });

  const sendMutation = useMutation({
    mutationFn: () => invoicesApi.send(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoice", id] }),
  });

  const payMutation = useMutation({
    mutationFn: () => invoicesApi.pay(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoice", id] }),
  });

  const cancelMutation = useMutation({
    mutationFn: () => invoicesApi.cancel(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoice", id] }),
  });

  if (isLoading) return <div>加载中...</div>;
  if (error || !data) return <div>加载失败</div>;

  const { invoice, items } = data;

  return (
    <div>
      <div className="page-header">
        <h2>
          发票 {invoice.number}
          <span
            className="status-badge"
            style={{
              backgroundColor: `${STATUS_COLORS[invoice.status] ?? "#64748b"}20`,
              color: STATUS_COLORS[invoice.status] ?? "#64748b",
              marginLeft: "0.75rem",
              fontSize: "0.8rem",
            }}
          >
            {STATUS_LABELS[invoice.status] ?? invoice.status}
          </span>
        </h2>
        <Link to="/invoices" className="btn">
          返回列表
        </Link>
      </div>

      <div className="invoice-detail-grid">
        <div className="card">
          <h4>基本信息</h4>
          <table className="info-table">
            <tbody>
              <tr>
                <td>开票日期</td>
                <td>{invoice.issueDate}</td>
              </tr>
              <tr>
                <td>到期日期</td>
                <td>{invoice.dueDate}</td>
              </tr>
              <tr>
                <td>客户</td>
                <td>{invoice.billingName ?? invoice.customerId ?? "无"}</td>
              </tr>
              <tr>
                <td>备注</td>
                <td>{invoice.notes ?? "无"}</td>
              </tr>
              {invoice.sentAt && (
                <tr>
                  <td>发送时间</td>
                  <td>{new Date(invoice.sentAt).toLocaleString()}</td>
                </tr>
              )}
              {invoice.paidAt && (
                <tr>
                  <td>付款时间</td>
                  <td>{new Date(invoice.paidAt).toLocaleString()}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h4>金额汇总</h4>
          <table className="info-table">
            <tbody>
              <tr>
                <td>小计</td>
                <td>
                  {(invoice.subtotal / 100).toFixed(2)} {invoice.currency}
                </td>
              </tr>
              {invoice.taxRate > 0 && (
                <tr>
                  <td>税率</td>
                  <td>
                    {invoice.taxRate}% ({(invoice.taxAmount / 100).toFixed(2)})
                  </td>
                </tr>
              )}
              {invoice.discount > 0 && (
                <tr>
                  <td>折扣</td>
                  <td>-{(invoice.discount / 100).toFixed(2)}</td>
                </tr>
              )}
              <tr className="total-row">
                <td>总计</td>
                <td className="positive">
                  {(invoice.totalAmount / 100).toFixed(2)} {invoice.currency}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <h3 style={{ marginTop: "1.5rem", marginBottom: "0.75rem" }}>明细条目</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>项目</th>
            <th style={{ textAlign: "center" }}>数量</th>
            <th style={{ textAlign: "right" }}>单价</th>
            <th style={{ textAlign: "right" }}>金额</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.description}</td>
              <td style={{ textAlign: "center" }}>{item.quantity}</td>
              <td style={{ textAlign: "right" }}>{(item.unitPrice / 100).toFixed(2)}</td>
              <td style={{ textAlign: "right", fontWeight: 600 }}>
                {(item.amount / 100).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="form-actions" style={{ marginTop: "1.5rem" }}>
        {invoice.status === "draft" && (
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending}
            >
              {sendMutation.isPending ? "发送中..." : "标记为已发送"}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              取消发票
            </button>
          </>
        )}
        {(invoice.status === "sent" || invoice.status === "overdue") && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => payMutation.mutate()}
            disabled={payMutation.isPending}
          >
            {payMutation.isPending ? "处理中..." : "标记为已付款"}
          </button>
        )}
        <a
          href={`/api/v1/invoices/${invoice.id}/export`}
          target="_blank"
          className="btn"
          rel="noreferrer"
        >
          导出 HTML
        </a>
      </div>
    </div>
  );
}
