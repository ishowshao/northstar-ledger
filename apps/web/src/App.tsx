import { Link, Route, Routes } from "react-router-dom";
import AccountForm from "./pages/AccountForm.js";
import Accounts from "./pages/Accounts.js";
import { CustomerForm, CustomerList } from "./pages/Customers.js";
import Dashboard from "./pages/Dashboard.js";
import { ProjectForm, ProjectList } from "./pages/Projects.js";
import Summary from "./pages/Summary.js";
import TransactionForm from "./pages/TransactionForm.js";
import Transactions from "./pages/Transactions.js";
import "./styles/app.css";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar-header">
          <Link to="/" className="sidebar-logo">
            ⭐ Northstar Ledger
          </Link>
        </div>
        <ul className="sidebar-nav">
          <li>
            <Link to="/">首页</Link>
          </li>
          <li>
            <Link to="/accounts">账户</Link>
          </li>
          <li>
            <Link to="/customers">客户</Link>
          </li>
          <li>
            <Link to="/projects">项目</Link>
          </li>
          <li>
            <Link to="/transactions">交易</Link>
          </li>
          <li>
            <Link to="/summary">汇总</Link>
          </li>
        </ul>
      </nav>
      <main className="main-content">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/accounts/new" element={<AccountForm />} />
        <Route path="/customers" element={<CustomerList />} />
        <Route path="/customers/new" element={<CustomerForm />} />
        <Route path="/projects" element={<ProjectList />} />
        <Route path="/projects/new" element={<ProjectForm />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/transactions/new" element={<TransactionForm />} />
        <Route path="/summary" element={<Summary />} />
      </Routes>
    </Layout>
  );
}
