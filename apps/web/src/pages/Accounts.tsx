import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { accountsApi } from "../lib/api.js";

export default function Accounts() {
  const { data: accounts, isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: accountsApi.list,
  });

  if (isLoading) return <div>加载中...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>账户</h2>
        <Link to="/accounts/new" className="btn btn-primary">
          新建账户
        </Link>
      </div>
      {accounts && accounts.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>类型</th>
              <th>币种</th>
              <th>余额</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{a.type}</td>
                <td>{a.currency}</td>
                <td className={a.balance >= 0 ? "positive" : "negative"}>{a.balance}</td>
                <td>{a.isActive ? "启用" : "停用"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty-state">暂无账户，请先创建一个账户</p>
      )}
    </div>
  );
}
