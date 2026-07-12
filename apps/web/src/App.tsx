import { Link, Route, Routes } from "react-router-dom";

function Home() {
  return (
    <div>
      <h1>Northstar Ledger</h1>
      <p>本地财务与经营台账系统</p>
      <nav>
        <ul>
          <li>
            <Link to="/">首页</Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  );
}
