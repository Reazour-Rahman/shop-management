import { useEffect, useState } from "react";
import {
  Container,
  Navbar,
  Nav,
  Table,
  Button,
  Form,
  Modal,
  Alert,
  Card,
  Badge,
  Row,
  Col,
} from "react-bootstrap";
import { api } from "./api";
import { Sales, Dues } from "./Sales.jsx";
import { Purchases, Suppliers, Stock } from "./Purchases.jsx";
import { Employees, Salary, Expenses } from "./Hr.jsx";
import { Attendance } from "./Attendance.jsx";
import { Orders } from "./Orders.jsx";
import {
  Routes,
  Route,
  NavLink,
  Navigate,
  useLocation,
} from "react-router-dom";
import { Dashboard, IncomeStatement } from "./Reports.jsx";

function Login({ onDone }) {
  const [f, setF] = useState({ username: "", password: "" });
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api("/login", "POST", f);
      onDone();
    } catch (x) {
      setErr(x.message);
    }
  };
  const DEV = {
    name: "Reazour Rahaman Rabbi",
    address: "Bangla Bazar",
    phone: "01878-919950",
  };
  return (
    <Container className="d-flex min-vh-100 align-items-center justify-content-center">
      <Card style={{ width: 360 }} className="shadow-sm">
        <Card.Body className="p-4">
          <h5 className="mb-1">Madina Glass and Thai Aluminium</h5>
          <p className="text-muted">Sign in to continue</p>
          {err && (
            <Alert variant="danger" className="py-2">
              {err}
            </Alert>
          )}
          <Form onSubmit={submit}>
            <Form.Group className="mb-3">
              <Form.Label>Username</Form.Label>
              <Form.Control
                autoFocus
                value={f.username}
                onChange={(e) => setF({ ...f, username: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                value={f.password}
                onChange={(e) => setF({ ...f, password: e.target.value })}
              />
            </Form.Group>
            <Button type="submit" className="w-100">
              Sign in
            </Button>
          </Form>
          <div className="text-center text-muted small mt-4">
            Developed by{" "}
            <b>
              {" "}
              <a
                href="https://reazourrahaman.netlify.app/"
                target="_blank"
                rel="noopener noreferrer"
              >
                {DEV.name}
              </a>{" "}
            </b>
            <br />
            {DEV.phone}
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}

// One reusable list + add/edit/delete screen, used for Clients and Products
function CrudPage({ title, path, noun, fields, columns, empty }) {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState("");
  const load = () =>
    api(`${path}?q=${encodeURIComponent(q)}`)
      .then(setRows)
      .catch((e) => setErr(e.message));
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [q]);

  const save = async (e) => {
    e.preventDefault();
    try {
      await (edit._id
        ? api(`${path}/${edit._id}`, "PUT", edit)
        : api(path, "POST", edit));
      setEdit(null);
      setErr("");
      load();
    } catch (x) {
      setErr(x.message);
    }
  };
  const del = async (r) => {
    if (!confirm(`Delete ${r.name}?`)) return;
    try {
      await api(`${path}/${r._id}`, "DELETE");
      load();
    } catch (x) {
      setErr(x.message);
    }
  };

  return (
    <>
      <Row className="mb-3 g-2 align-items-center">
        <Col>
          <h4 className="mb-0">{title}</h4>
        </Col>
        <Col md={4}>
          <Form.Control
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </Col>
        <Col xs="auto">
          <Button
            onClick={() => {
              setErr("");
              setEdit({});
            }}
          >
            Add {noun}
          </Button>
        </Col>
      </Row>
      {err && !edit && <Alert variant="danger">{err}</Alert>}
      <Card className="shadow-sm">
        <div className="table-responsive">
          <Table hover className="mb-0">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.label}>{c.label}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  {columns.map((c) => (
                    <td key={c.label}>{c.render(r)}</td>
                  ))}
                  <td className="text-end text-nowrap">
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      className="me-1"
                      onClick={() => {
                        setErr("");
                        setEdit(r);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => del(r)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="text-center text-muted py-4"
                  >
                    {empty}
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      </Card>

      <Modal show={!!edit} onHide={() => setEdit(null)} centered>
        <Form onSubmit={save}>
          <Modal.Header closeButton>
            <Modal.Title>
              {edit?._id ? `Edit ${noun}` : `Add ${noun}`}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {err && (
              <Alert variant="danger" className="py-2">
                {err}
              </Alert>
            )}
            {edit &&
              fields
                .filter((f) => !(f.newOnly && edit._id))
                .map((f) =>
                  f.type === "check" ? (
                    <Form.Check
                      key={f.key}
                      className="mb-3"
                      label={f.label}
                      checked={!!edit[f.key]}
                      onChange={(e) =>
                        setEdit({ ...edit, [f.key]: e.target.checked })
                      }
                    />
                  ) : (
                    <Form.Group key={f.key} className="mb-3">
                      <Form.Label>{f.label}</Form.Label>
                      <Form.Control
                        type={f.type || "text"}
                        required={f.required}
                        min={f.type === "number" ? 0 : undefined}
                        step="any"
                        value={
                          f.type === "date"
                            ? String(edit[f.key] ?? "").slice(0, 10)
                            : (edit[f.key] ?? "")
                        }
                        onChange={(e) =>
                          setEdit({ ...edit, [f.key]: e.target.value })
                        }
                      />
                      {f.help && (
                        <Form.Text className="text-muted">{f.help}</Form.Text>
                      )}
                    </Form.Group>
                  ),
                )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button type="submit">Save {noun}</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}

const Clients = () => (
  <CrudPage
    title="Clients"
    path="/clients"
    noun="client"
    empty="No clients yet. Add your first client."
    fields={[
      { key: "name", label: "Name", required: true },
      { key: "phone", label: "Mobile number", required: true },
      { key: "address", label: "Address" },
      { key: "note", label: "Note" },
      {
        key: "openingDue",
        label: "Opening due (৳): what this client already owed before you started using this system",
        type: "number",
        help: "Leave empty if nothing is owed. It is not counted as a sale in the income statement.",
      },
      {
        key: "openingDate",
        label: "Opening due as of date",
        type: "date",
        help: "Empty means today.",
      },
    ]}
    columns={[
      { label: "Client ID", render: (r) => <strong>{r.clientId}</strong> },
      { label: "Name", render: (r) => r.name },
      { label: "Mobile", render: (r) => r.phone },
      { label: "Address", render: (r) => r.address },
      {
        label: "Opening due",
        render: (r) =>
          r.openingDue > 0
            ? `৳${r.openingLeft ?? r.openingDue}${r.openingLeft < r.openingDue ? ` of ৳${r.openingDue}` : ""}`
            : "",
      },
    ]}
  />
);

const Products = () => (
  <CrudPage
    title="Products & services"
    path="/products"
    noun="item"
    empty="No items yet. Add a glass type or a service like installation."
    fields={[
      { key: "name", label: "Product name", required: true },
      { key: "brand", label: "Brand" },
      { key: "thickness", label: "Thickness (MM)" },
      { key: "color", label: "Color" },
      { key: "size", label: "Size" },
      { key: "grade", label: "Grade (A, B, C… optional)" },
      { key: "lth", label: "LTH (length)", type: "number" },
      { key: "wth", label: "WTH (width)", type: "number" },
      { key: "pcs", label: "PCS in stock (separate count, not used in calculations)", type: "number" },
      { key: "unit", label: "Unit (sq ft, piece…)" },
      { key: "price", label: "Default price (৳)", type: "number" },
      {
        key: "stock",
        label: "Opening stock (only when adding)",
        type: "number",
        newOnly: true,
      },
      {
        key: "openingCost",
        label: "Opening stock purchase cost per unit (৳)",
        type: "number",
      },
      {
        key: "openingTotal",
        label:
          "OR total purchase cost of the opening stock (৳), used when per-unit cost is empty",
        type: "number",
        newOnly: true,
      },
      { key: "lowStock", label: "Low stock alert at", type: "number" },
      {
        key: "isService",
        label: "This is a service (no stock, e.g. installation)",
        type: "check",
      },
      {
        key: "isContract",
        label:
          "Contract + service item (Window, Door, Ceiling…). Materials are added later and do not change the sale amount",
        type: "check",
      },
    ]}
    columns={[
      { label: "Product", render: (r) => <strong>{r.name}</strong> },
      { label: "Brand", render: (r) => r.brand },
      { label: "MM", render: (r) => r.thickness },
      { label: "Color", render: (r) => r.color },
      { label: "Size", render: (r) => r.size },
      { label: "Grade", render: (r) => r.grade },
      { label: "LTH", render: (r) => r.lth },
      { label: "WTH", render: (r) => r.wth },
      { label: "PCS", render: (r) => r.pcs ?? 0 },
      { label: "Unit", render: (r) => r.unit },
      { label: "Price", render: (r) => `৳${r.price}` },
      {
        label: "Avg cost",
        render: (r) => (r.isService ? "–" : `৳${(r.avgCost || 0).toFixed(2)}`),
      },
      {
        label: "Stock",
        render: (r) =>
          r.isService ? (
            <span className="text-muted">Service</span>
          ) : (
            <>
              {r.stock}{" "}
              {r.stock <= r.lowStock && <Badge bg="danger">Low</Badge>}
            </>
          ),
      },
    ]}
  />
);

const MENU = [
  { label: "Dashboard", to: "/dashboard", icon: "📊" },
  {
    label: "Inventory & Products",
    icon: "📦",
    items: [
      ["Products", "/products"],
      ["Stock", "/stock"],
    ],
  },
  {
    label: "Transactions & Accounting",
    icon: "💰",
    items: [
      ["Orders", "/orders"],
      ["Sales", "/sales"],
      ["Purchases", "/purchases"],
      ["Dues", "/dues"],
      ["Expenses", "/expenses"],
      ["Income Statement", "/income-statement"],
    ],
  },
  {
    label: "Parties / Contacts",
    icon: "🤝",
    items: [
      ["Suppliers", "/suppliers"],
      ["Clients", "/clients"],
    ],
  },
  {
    label: "HR & Payroll",
    icon: "👥",
    items: [
      ["Employees", "/employees"],
      ["Attendance", "/attendance"],
      ["Salary", "/salary"],
    ],
  },
];
const TITLES = Object.fromEntries(
  MENU.flatMap((m) =>
    m.items ? m.items.map(([l, t]) => [t, l]) : [[m.to, m.label]],
  ),
);

export default function App() {
  const [auth, setAuth] = useState(null),
    [open, setOpen] = useState(false),
    [shut, setShut] = useState({});
  const { pathname } = useLocation();
  useEffect(() => {
    api("/me")
      .then((d) => setAuth(d.loggedIn))
      .catch(() => setAuth(false));
  }, []);
  if (auth === null) return null;
  if (!auth) return <Login onDone={() => setAuth(true)} />;

  const backup = async () => {
    const b = await (await fetch("/api/backup")).blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = `thai-glass-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  const printPage = () => {
    document.body.classList.add("print-page");
    window.print();
    document.body.classList.remove("print-page");
  };
  const page = (path, el) => <Route path={path} element={el} />;
  const DEV = {
    name: "Reazour Rahaman Rabbi",
    address: "Bangla Bazar",
    phone: "01878-919950",
  };
  return (
    <div className="app-shell">
      <aside className={"sidebar" + (open ? " open" : "")} >
        <div className="d-flex align-items-center pt-3" style={{ backgroundColor: "white" }}>
          {/* <img src="../asset/Logo.png" width={100} alt="" /> */}
          <img src='https://i.postimg.cc/r0L9SS4s/Madina-Glass-Architectural-Logo.png' width={100} border='0' alt='Madina-Glass-Architectural-Logo'/>
          <div className="sb-brand p-0">
            <h6 className=" mb-0" style={{ color: "#011a33" }}>
              Madina Glass & <br />
              Thai Aluminium
            </h6>
            <small style={{ color: "#011a33" }}>Business Manager</small>
          </div>
        </div>
        <nav className="sb-nav">
          {MENU.map((m) =>
            m.items ? (
              <div key={m.label} className="mb-1">
                <button
                  className="sb-group"
                  onClick={() =>
                    setShut({ ...shut, [m.label]: !shut[m.label] })
                  }
                >
                  <span>
                    {m.icon}&nbsp; {m.label}
                  </span>
                  <span>{shut[m.label] ? "▸" : "▾"}</span>
                </button>
                {!shut[m.label] &&
                  m.items.map(([l, to]) => (
                    <NavLink
                      key={to}
                      to={to}
                      className="sb-link"
                      onClick={() => setOpen(false)}
                    >
                      {l}
                    </NavLink>
                  ))}
              </div>
            ) : (
              <NavLink
                key={m.to}
                to={m.to}
                className="sb-group sb-top"
                onClick={() => setOpen(false)}
              >
                <span>
                  {m.icon}&nbsp; {m.label}
                </span>
              </NavLink>
            ),
          )}
        </nav>
        <div className="text-center small mt-4">
          Developed by{" "}
          <b>
            {" "}
            <a
              href="https://reazourrahaman.netlify.app/"
              target="_blank"
              rel="noopener noreferrer"
            >
              {DEV.name}
            </a>{" "}
          </b>
        </div>
        <div className="sb-foot">
          <Button
            size="sm"
            variant="outline-light"
            className="flex-fill"
            onClick={backup}
          >
            Backup
          </Button>
          <Button
            size="sm"
            variant="light"
            className="flex-fill"
            onClick={() => api("/logout", "POST").then(() => setAuth(false))}
          >
            Log out
          </Button>
        </div>
      </aside>
      {open && <div className="sb-overlay" onClick={() => setOpen(false)} />}
      <main className="main">
        <div className="topbar">
          <Button
            variant="outline-secondary"
            size="sm"
            className="d-lg-none"
            onClick={() => setOpen(true)}
          >
            ☰
          </Button>
          <h5 className="mb-0 me-auto">{TITLES[pathname] || "Thai Glass"}</h5>
          <Button size="sm" variant="outline-secondary" onClick={printPage}>
            Print page
          </Button>
        </div>
        <Container fluid className="py-3 px-3 px-lg-4">
          <Routes>
            {page("/dashboard", <Dashboard />)}
            {page("/income-statement", <IncomeStatement />)}
            {page("/orders", <Orders />)}
            {page("/sales", <Sales />)}
            {page("/dues", <Dues />)}
            {page("/purchases", <Purchases />)}
            {page("/suppliers", <Suppliers />)}
            {page("/stock", <Stock />)}
            {page("/employees", <Employees />)}
            {page("/attendance", <Attendance />)}
            {page("/salary", <Salary />)}
            {page("/expenses", <Expenses />)}
            {page("/clients", <Clients />)}
            {page("/products", <Products />)}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Container>
      </main>
    </div>
  );
}
