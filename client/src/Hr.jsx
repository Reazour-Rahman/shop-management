import { useEffect, useState } from "react";
import {
  Button,
  Form,
  Modal,
  Alert,
  Card,
  Table,
  Badge,
  Row,
  Col,
} from "react-bootstrap";
import { api } from "./api";
import {
  PayModal,
  MethodSelect,
  money,
  fdate,
  today,
  COLOR,
} from "./Sales.jsx";

const period = (r) => `${fdate(r.from)} – ${fdate(r.to)}`;

export function Employees() {
  const [rows, setRows] = useState([]),
    [edit, setEdit] = useState(null),
    [hist, setHist] = useState(null),
    [err, setErr] = useState("");
  const load = () =>
    api("/employees-summary")
      .then(setRows)
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  const open = (e) => {
    setErr("");
    setEdit({
      ...e,
      phones: (e.phones || []).join(", "),
      joinDate: e.joinDate?.slice(0, 10) || "",
    });
  };
  const save = async (ev) => {
    ev.preventDefault();
    try {
      await (edit._id
        ? api(`/employees/${edit._id}`, "PUT", edit)
        : api("/employees", "POST", edit));
      setEdit(null);
      setErr("");
      load();
    } catch (x) {
      setErr(x.message);
    }
  };
  const del = async (e) => {
    if (!confirm(`Delete ${e.name}?`)) return;
    try {
      await api(`/employees/${e._id}`, "DELETE");
      load();
    } catch (x) {
      setErr(x.message);
    }
  };
  const showHist = async (e) =>
    setHist({ e, ...(await api(`/employees/${e._id}/history`)) });
  const F = [
    ["name", "Name", "text", true],
    ["father", "Father's name"],
    ["mother", "Mother's name"],
    ["address", "Address"],
    ["phones", "Phone number(s), separated by comma"],
    ["salary", "Monthly salary (৳)", "number"],
    ["nid", "NID / Birth certificate number"],
    ["joinDate", "Joining date", "date"],
    [
      "deviceId",
      "Attendance machine ID (the number enrolled on the machine). Empty = digits of the employee ID, E-0007 is 7",
    ],
  ];
  return (
    <>
      <Row className="mb-3 g-2 align-items-center">
        <Col>
          <h4 className="mb-0">Employees</h4>
        </Col>
        <Col xs="auto">
          <Button onClick={() => open({ active: true, joinDate: today() })}>
            Add employee
          </Button>
        </Col>
      </Row>
      {err && !edit && (
        <Alert variant="danger" dismissible onClose={() => setErr("")}>
          {err}
        </Alert>
      )}
      <Card className="shadow-sm">
        <div className="table-responsive">
          <Table hover className="mb-0">
            <thead>
              <tr>
                <th>ID</th>
                <th>Employee</th>
                <th>Joined</th>
                <th className="text-end">Monthly salary</th>
                <th className="text-end">Total paid</th>
                <th className="text-end">Salary due</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ employee: e, paid, due, months }) => (
                <tr key={e._id}>
                  <td>
                    <b>{e.empId}</b>
                  </td>
                  <td>
                    {e.name}
                    <div className="small text-muted">
                      {(e.phones || []).join(", ")}
                    </div>
                  </td>
                  <td>{e.joinDate ? fdate(e.joinDate) : ""}</td>
                  <td className="text-end">{money(e.salary)}</td>
                  <td className="text-end">
                    {money(paid)}
                    <div className="small text-muted">{months} months</div>
                  </td>
                  <td className="text-end fw-bold">{money(due)}</td>
                  <td>
                    <Badge bg={e.active ? "success" : "secondary"}>
                      {e.active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="text-end text-nowrap">
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      className="me-1"
                      onClick={() => showHist(e)}
                    >
                      Salary history
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      className="me-1"
                      onClick={() => open(e)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => del(e)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan="8" className="text-center text-muted py-4">
                    No employees yet.
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
              {edit?._id ? "Edit employee" : "Add employee"}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {err && (
              <Alert variant="danger" className="py-2">
                {err}
              </Alert>
            )}
            {edit &&
              F.map(([k, l, t, req]) => (
                <Form.Group key={k} className="mb-2">
                  <Form.Label className="mb-0 small">{l}</Form.Label>
                  <Form.Control
                    type={t || "text"}
                    required={req}
                    min={t === "number" ? 0 : undefined}
                    step="any"
                    value={edit[k] ?? ""}
                    onChange={(e) => setEdit({ ...edit, [k]: e.target.value })}
                  />
                </Form.Group>
              ))}
            {edit && (
              <Form.Check
                label="Active employee"
                checked={!!edit.active}
                onChange={(e) => setEdit({ ...edit, active: e.target.checked })}
              />
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button type="submit">Save employee</Button>
          </Modal.Footer>
        </Form>
      </Modal>
      <Modal show={!!hist} onHide={() => setHist(null)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>{hist?.e.name}: salary history</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {hist && (
            <>
              <p>
                Total salary paid since joining:{" "}
                <b>{money(hist.records.reduce((s, r) => s + r.paid, 0))}</b> ·
                Due:{" "}
                <b className="text-danger">
                  {money(hist.records.reduce((s, r) => s + r.due, 0))}
                </b>
              </p>
              <Table size="sm">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th className="text-end">Salary</th>
                    <th className="text-end">Paid</th>
                    <th className="text-end">Due</th>
                    <th>Payments</th>
                  </tr>
                </thead>
                <tbody>
                  {hist.records.map((r) => (
                    <tr key={r._id}>
                      <td>{period(r)}</td>
                      <td className="text-end">{money(r.amount)}</td>
                      <td className="text-end">{money(r.paid)}</td>
                      <td className="text-end">{money(r.due)}</td>
                      <td className="small">
                        {hist.payments
                          .filter((p) => p.record === r._id)
                          .map((p) => `${fdate(p.date)}: ${money(p.amount)}`)
                          .join(" · ") || "–"}
                      </td>
                    </tr>
                  ))}
                  {!hist.records.length && (
                    <tr>
                      <td colSpan="5" className="text-center text-muted py-3">
                        No salary records yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
}

export function Salary() {
  const [rows, setRows] = useState([]),
    [emps, setEmps] = useState([]),
    [exp, setExp] = useState([]);
  const [month, setMonth] = useState(today().slice(0, 7)),
    [onlyDue, setOnlyDue] = useState(false);
  const [add, setAdd] = useState(null),
    [pay, setPay] = useState(null),
    [err, setErr] = useState("");
  const load = () => {
    api(`/salary-records?month=${month}&onlyDue=${onlyDue ? 1 : 0}`)
      .then(setRows)
      .catch((e) => setErr(e.message));
    api("/salary-expense").then(setExp);
  };
  useEffect(() => {
    load();
  }, [month, onlyDue]);
  useEffect(() => {
    api("/employees").then((e) => setEmps(e.filter((x) => x.active)));
  }, []);
  const saveAdd = async (e) => {
    e.preventDefault();
    try {
      await api("/salary-records", "POST", add);
      setAdd(null);
      setErr("");
      load();
    } catch (x) {
      setErr(x.message);
    }
  };
  const bulk = async () => {
    if (!month) return setErr("Choose a month first");
    if (!confirm(`Add ${month} salary for all active employees?`)) return;
    try {
      const r = await api("/salary-records/bulk", "POST", { month });
      setErr("");
      alert(`${r.added} salary record(s) added`);
      load();
    } catch (x) {
      setErr(x.message);
    }
  };
  const del = async (r) => {
    if (!confirm("Delete this salary record and its payments?")) return;
    try {
      await api(`/salary-records/${r._id}`, "DELETE");
      load();
    } catch (x) {
      setErr(x.message);
    }
  };
  const sum = (k) => rows.reduce((s, x) => s + x[k], 0);
  return (
    <>
      <Row className="mb-3 g-2 align-items-center">
        <Col>
          <h4 className="mb-0">Salary</h4>
        </Col>
        <Col xs="auto">
          <Button variant="outline-primary" onClick={bulk}>
            Add for all active employees
          </Button>
        </Col>
        <Col xs="auto">
          <Button
            onClick={() => {
              setErr("");
              setAdd({
                employee: "",
                month: month || today().slice(0, 7),
                amount: "",
              });
            }}
          >
            Add salary month
          </Button>
        </Col>
      </Row>
      <Row className="g-2 mb-3 align-items-center">
        <Col md={3}>
          <Form.Control
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </Col>
        <Col md="auto">
          <Form.Check
            label="Only unpaid (leave month empty for all months)"
            checked={onlyDue}
            onChange={(e) => setOnlyDue(e.target.checked)}
          />
        </Col>
      </Row>
      {err && !add && (
        <Alert variant="danger" dismissible onClose={() => setErr("")}>
          {err}
        </Alert>
      )}
      <Card className="shadow-sm mb-4">
        <div className="table-responsive">
          <Table hover className="mb-0">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Salary period</th>
                <th className="text-end">Salary</th>
                <th className="text-end">Paid</th>
                <th className="text-end">Due</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  <td>
                    <b>{r.employee?.name}</b>
                    <div className="small text-muted">{r.employee?.empId}</div>
                  </td>
                  <td>{period(r)}</td>
                  <td className="text-end">{money(r.amount)}</td>
                  <td className="text-end">{money(r.paid)}</td>
                  <td className="text-end">{money(r.due)}</td>
                  <td>
                    <Badge bg={COLOR[r.status]}>{r.status}</Badge>
                  </td>
                  <td className="text-end text-nowrap">
                    {r.due > 0 && (
                      <Button
                        size="sm"
                        className="me-1"
                        onClick={() =>
                          setPay({
                            title: `Salary: ${r.employee?.name}, ${period(r)}`,
                            max: r.due,
                            url: `/salary-records/${r._id}/payments`,
                          })
                        }
                      >
                        Pay salary
                      </Button>
                    )}
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
                  <td colSpan="7" className="text-center text-muted py-4">
                    No salary records here. Use "Add for all active employees".
                  </td>
                </tr>
              )}
            </tbody>
            {!!rows.length && (
              <tfoot>
                <tr className="fw-bold">
                  <td colSpan="2">Total</td>
                  <td className="text-end">{money(sum("amount"))}</td>
                  <td className="text-end">{money(sum("paid"))}</td>
                  <td className="text-end">{money(sum("due"))}</td>
                  <td colSpan="2" />
                </tr>
              </tfoot>
            )}
          </Table>
        </div>
      </Card>
      <h5>Salary expense by month (salary actually paid)</h5>
      <Card className="shadow-sm" style={{ maxWidth: 420 }}>
        <Table size="sm" className="mb-0">
          <tbody>
            {exp.map((x) => (
              <tr key={x.month}>
                <td>{x.month}</td>
                <td className="text-end">{money(x.total)}</td>
              </tr>
            ))}
            {!exp.length && (
              <tr>
                <td className="text-muted">No salary paid yet.</td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
      <Modal show={!!add} onHide={() => setAdd(null)} centered>
        <Form onSubmit={saveAdd}>
          <Modal.Header closeButton>
            <Modal.Title>Add salary month</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {err && (
              <Alert variant="danger" className="py-2">
                {err}
              </Alert>
            )}
            {add && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>Employee</Form.Label>
                  <Form.Select
                    required
                    value={add.employee}
                    onChange={(e) =>
                      setAdd({
                        ...add,
                        employee: e.target.value,
                        amount:
                          emps.find((x) => x._id === e.target.value)?.salary ??
                          "",
                      })
                    }
                  >
                    <option value="">Choose…</option>
                    {emps.map((e) => (
                      <option key={e._id} value={e._id}>
                        {e.empId} · {e.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Month (whole month, 1st to last day)</Form.Label>
                  <Form.Control
                    type="month"
                    required
                    value={add.month}
                    onChange={(e) => setAdd({ ...add, month: e.target.value })}
                  />
                </Form.Group>
                <Form.Group>
                  <Form.Label>Salary for this month (৳)</Form.Label>
                  <Form.Control
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={add.amount}
                    onChange={(e) => setAdd({ ...add, amount: e.target.value })}
                  />
                </Form.Group>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setAdd(null)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </Modal.Footer>
        </Form>
      </Modal>
      {pay && (
        <PayModal
          target={pay}
          onHide={() => setPay(null)}
          onDone={() => {
            setPay(null);
            load();
          }}
        />
      )}
    </>
  );
}

export function Expenses() {
  const [rows, setRows] = useState([]),
    [cats, setCats] = useState([]),
    [fl, setFl] = useState({ q: "", from: "", to: "", category: "" });
  const [add, setAdd] = useState(
      window.location.search.includes("new=1")
        ? { category: "", amount: "", date: today(), note: "", method: "Cash" }
        : null,
    ),
    [err, setErr] = useState("");
  const load = () =>
    api("/expenses?" + new URLSearchParams(fl))
      .then(setRows)
      .catch((e) => setErr(e.message));
  const loadCats = () => api("/expense-categories").then(setCats);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [fl]);
  useEffect(() => {
    loadCats();
  }, []);
  const save = async (e) => {
    e.preventDefault();
    try {
      await api("/expenses", "POST", add);
      setAdd(null);
      setErr("");
      load();
      loadCats();
    } catch (x) {
      setErr(x.message);
    }
  };
  const del = async (x) => {
    if (!confirm("Delete this expense?")) return;
    try {
      await api(`/expenses/${x._id}`, "DELETE");
      load();
    } catch (y) {
      setErr(y.message);
    }
  };
  const total = rows.reduce((s, x) => s + x.amount, 0);
  const by = {};
  rows.forEach((x) => {
    by[x.category] = (by[x.category] || 0) + x.amount;
  });
  return (
    <>
      <Row className="mb-3 g-2 align-items-center">
        <Col>
          <h4 className="mb-0">Other expenses</h4>
        </Col>
        <Col xs="auto">
          <Button
            onClick={() => {
              setErr("");
              setAdd({
                category: "",
                amount: "",
                date: today(),
                note: "",
                method: "Cash",
              });
            }}
          >
            New expense
          </Button>
        </Col>
      </Row>
      <Row className="g-2 mb-3">
        <Col md={3}>
          <Form.Control
            placeholder="Search category or note"
            value={fl.q}
            onChange={(e) => setFl({ ...fl, q: e.target.value })}
          />
        </Col>
        <Col md={3}>
          <Form.Select
            value={fl.category}
            onChange={(e) => setFl({ ...fl, category: e.target.value })}
          >
            <option value="">All categories</option>
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Form.Select>
        </Col>
        <Col md={3}>
          <Form.Control
            type="date"
            value={fl.from}
            onChange={(e) => setFl({ ...fl, from: e.target.value })}
          />
        </Col>
        <Col md={3}>
          <Form.Control
            type="date"
            value={fl.to}
            onChange={(e) => setFl({ ...fl, to: e.target.value })}
          />
        </Col>
      </Row>
      {err && !add && (
        <Alert variant="danger" dismissible onClose={() => setErr("")}>
          {err}
        </Alert>
      )}
      <Row className="g-3">
        <Col lg={8}>
          <Card className="shadow-sm">
            <div className="table-responsive">
              <Table hover className="mb-0">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Note</th>
                    <th className="text-end">Amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((x) => (
                    <tr key={x._id}>
                      <td>{fdate(x.date)}</td>
                      <td>
                        {x.category}
                        <div className="small text-muted">{x.method}</div>
                      </td>
                      <td>{x.note}</td>
                      <td className="text-end">{money(x.amount)}</td>
                      <td className="text-end">
                        <Button
                          size="sm"
                          variant="outline-danger"
                          onClick={() => del(x)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr>
                      <td colSpan="5" className="text-center text-muted py-4">
                        No expenses found.
                      </td>
                    </tr>
                  )}
                </tbody>
                {!!rows.length && (
                  <tfoot>
                    <tr className="fw-bold">
                      <td colSpan="3">Total</td>
                      <td className="text-end">{money(total)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </Table>
            </div>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="shadow-sm">
            <Card.Body>
              <h6>Category-wise total</h6>
              <Table size="sm" className="mb-0">
                <tbody>
                  {Object.entries(by)
                    .sort((a, b) => b[1] - a[1])
                    .map(([c, v]) => (
                      <tr key={c}>
                        <td>{c}</td>
                        <td className="text-end">{money(v)}</td>
                      </tr>
                    ))}
                  {!rows.length && (
                    <tr>
                      <td className="text-muted">Nothing to show</td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <Modal show={!!add} onHide={() => setAdd(null)} centered>
        <Form onSubmit={save}>
          <Modal.Header closeButton>
            <Modal.Title>New expense</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {err && (
              <Alert variant="danger" className="py-2">
                {err}
              </Alert>
            )}
            {add && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>Category (choose or type a new one)</Form.Label>
                  <Form.Control
                    required
                    list="cats"
                    value={add.category}
                    onChange={(e) =>
                      setAdd({ ...add, category: e.target.value })
                    }
                  />
                  <datalist id="cats">
                    {cats.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Amount (৳)</Form.Label>
                  <Form.Control
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={add.amount}
                    onChange={(e) => setAdd({ ...add, amount: e.target.value })}
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Date</Form.Label>
                  <Form.Control
                    type="date"
                    required
                    value={add.date}
                    onChange={(e) => setAdd({ ...add, date: e.target.value })}
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Paid by</Form.Label>
                  <MethodSelect
                    value={add.method}
                    onChange={(v) => setAdd({ ...add, method: v })}
                  />
                </Form.Group>
                <Form.Group>
                  <Form.Label>Note (optional)</Form.Label>
                  <Form.Control
                    value={add.note}
                    onChange={(e) => setAdd({ ...add, note: e.target.value })}
                  />
                </Form.Group>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setAdd(null)}>
              Cancel
            </Button>
            <Button type="submit">Save expense</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}
