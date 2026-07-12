import { Link } from "react-router-dom";

export default function Dashboard() {
  return (
    <div>
      <h1>Northstar Ledger</h1>
      <p className="subtitle">本地财务与经营台账系统</p>

      <div className="nav-grid">
        <Link to="/accounts" className="nav-card">
          <h3>📒 账户</h3>
          <p>管理银行账户和现金账户</p>
        </Link>
        <Link to="/customers" className="nav-card">
          <h3>👥 客户</h3>
          <p>管理客户信息</p>
        </Link>
        <Link to="/projects" className="nav-card">
          <h3>📋 项目</h3>
          <p>管理项目</p>
        </Link>
        <Link to="/transactions" className="nav-card">
          <h3>💰 交易</h3>
          <p>记录收入与支出</p>
        </Link>
        <Link to="/transactions/new" className="nav-card">
          <h3>➕ 新增交易</h3>
          <p>快速记录一笔交易</p>
        </Link>
        <Link to="/summary" className="nav-card">
          <h3>📊 汇总</h3>
          <p>查看经营报表</p>
        </Link>
      </div>
    </div>
  );
}
