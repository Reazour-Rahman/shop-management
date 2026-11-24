import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  Modal,
  Nav,
  Row,
  Table,
} from "react-bootstrap";
import { api } from "./api";
import { fdate, today } from "./Sales.jsx";

const STATUS = {
  Present: "success",
  Late: "warning",
  Absent: "danger",
  Off: "secondary",
  "Not yet": "light",
};
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ago = (iso) => {
  if (!iso) return "never";
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} hours ago`;
  return `${Math.round(m / 1440)} days ago`;
};

// All punches of one person on one day, with add and delete for corrections
function Punches({ target, onHide, onChanged }) {
  const [list, setList] = useState([]),
    [time, setTime] = useState(""),
    [err, setErr] = useState("");
  const load = () =>
    api(`/attendance/punches?employee=${target.employee._id}&date=${target.date}`)
      .then(setList)
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  const add = async (e) => {
    e.preventDefault();
    try {
      await api("/attendance/manual", "POST", {
        employee: target.employee._id,
        date: target.date,
        time,
      });
      setTime("");
      setErr("");
      await load();
      onChanged();
    } catch (x) {
      setErr(x.message);
    }
  };
  const del = async (p) => {
    if (!confirm(`Delete the ${p.text} punch?`)) return;
    try {
      await api(`/attendance/punches/${p._id}`, "DELETE");
      await load();
      onChanged();
    } catch (x) {
      setErr(x.message);
    }
  };
  return (
    <Modal show onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          {target.employee.name} · {fdate(target.date)}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {err && (
          <Alert variant="danger" className="py-2">
            {err}
          </Alert>
        )}
        <Table size="sm">
          <tbody>
            {list.map((p) => (
              <tr key={p._id}>
                <td className="fw-bold">{p.text}</td>
                <td>
                  <Badge bg={p.source === "manual" ? "info" : "secondary"}>
                    {p.source === "manual" ? "Added by hand" : "Machine"}
                  </Badge>
                </td>
                <td className="text-end">
                  <Button
                    size="sm"
                    variant="outline-danger"
                    onClick={() => del(p)}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
            {!list.length && (
              <tr>
                <td className="text-muted">No punches on this day.</td>
              </tr>
            )}
          </tbody>
        </Table>
        <Form onSubmit={add} className="d-flex gap-2 align-items-end">
          <div className="flex-grow-1">
            <Form.Label className="mb-0 small">
              Add a missed punch (time)
            </Form.Label>
            <Form.Control
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <Button type="submit">Add</Button>
        </Form>
        <div className="small text-muted mt-2">
          The first punch of the day is In. The last one is Out.
        </div>
      </Modal.Body>
    </Modal>
  );
}

function Day({ onChanged: tick, version }) {
  const [date, setDate] = useState(today()),
    [d, setD] = useState(null),
    [err, setErr] = useState(""),
    [pun, setPun] = useState(null);
  const load = () =>
    api(`/attendance/day?date=${date}`)
      .then((x) => {
        setD(x);
        setErr("");
      })
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, [date, version]);
  const count = (s) => d?.rows.filter((r) => r.status === s).length || 0;
  return (
    <>
      <Row className="g-2 mb-3 align-items-center">
        <Col xs="auto">
          <Form.Control
            type="date"
            value={date}
            max={today()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </Col>
        <Col>
          {d && (
            <span>
              <Badge bg="success" className="me-1">
                Present {count("Present")}
              </Badge>
              <Badge bg="warning" text="dark" className="me-1">
                Late {count("Late")}
              </Badge>
              <Badge bg="danger" className="me-1">
                Absent {count("Absent")}
              </Badge>
              <Badge bg="secondary">Off {count("Off")}</Badge>
            </span>
          )}
        </Col>
      </Row>
      {err && <Alert variant="danger">{err}</Alert>}
      {d && Object.keys(d.unknown).length > 0 && (
        <Alert variant="warning">
          Punches came from machine ID{" "}
          <b>{Object.keys(d.unknown).join(", ")}</b> but no employee has that
          ID. Open Employees and set the "Attendance machine ID" of the right
          person.
        </Alert>
      )}
      <Card className="shadow-sm">
        <div className="table-responsive">
          <Table hover className="mb-0">
            <thead>
              <tr>
                <th>Employee</th>
                <th>In</th>
                <th>Out</th>
                <th className="text-end">Hours</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {d?.rows.map((r) => (
                <tr key={r.employee._id}>
                  <td>
                    <b>{r.employee.name}</b>
                    <div className="small text-muted">
                      {r.employee.empId} · machine ID {r.employee.deviceKey}
                    </div>
                  </td>
                  <td>{r.inText}</td>
                  <td>{r.outText}</td>
                  <td className="text-end">{r.hours || ""}</td>
                  <td>
                    {r.status && (
                      <Badge
                        bg={STATUS[r.status]}
                        text={
                          r.status === "Late" || r.status === "Not yet"
                            ? "dark"
                            : undefined
                        }
                      >
                        {r.status}
                      </Badge>
                    )}
                  </td>
                  <td className="text-end">
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      onClick={() => setPun({ employee: r.employee, date })}
                    >
                      Punches ({r.punches})
                    </Button>
                  </td>
                </tr>
              ))}
              {d && !d.rows.length && (
                <tr>
                  <td colSpan="6" className="text-center text-muted py-4">
                    No active employees yet.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      </Card>
      {pun && (
        <Punches
          target={pun}
          onHide={() => setPun(null)}
          onChanged={() => {
            load();
            tick();
          }}
        />
      )}
    </>
  );
}

function Month({ version }) {
  const [month, setMonth] = useState(today().slice(0, 7)),
    [d, setD] = useState(null),
    [err, setErr] = useState("");
  useEffect(() => {
    api(`/attendance/month?month=${month}`)
      .then((x) => {
        setD(x);
        setErr("");
      })
      .catch((e) => setErr(e.message));
  }, [month, version]);
  const color = { P: "#198754", L: "#b58100", A: "#dc3545", O: "#6c757d" };
  return (
    <>
      <Row className="g-2 mb-3 align-items-center">
        <Col xs="auto">
          <Form.Control
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
          />
        </Col>
        <Col className="small text-muted">
          P present · L late · A absent · O weekly off
        </Col>
      </Row>
      {err && <Alert variant="danger">{err}</Alert>}
      <Card className="shadow-sm">
        <div className="table-responsive">
          <Table bordered size="sm" className="mb-0 text-center align-middle">
            <thead>
              <tr>
                <th className="text-start">Employee</th>
                {d?.days.map((x) => (
                  <th key={x} style={{ minWidth: 26 }}>
                    {x.slice(8)}
                  </th>
                ))}
                <th>Present</th>
                <th>Late</th>
                <th>Absent</th>
                <th>Hours</th>
              </tr>
            </thead>
            <tbody>
              {d?.rows.map((r) => (
                <tr key={r.employee._id}>
                  <td className="text-start text-nowrap">
                    <b>{r.employee.name}</b>{" "}
                    <span className="small text-muted">{r.employee.empId}</span>
                  </td>
                  {d.days.map((x) => (
                    <td
                      key={x}
                      style={{ color: color[r.cells[x]], fontWeight: 600 }}
                    >
                      {r.cells[x]}
                    </td>
                  ))}
                  <td className="fw-bold">{r.present}</td>
                  <td className="fw-bold">{r.late}</td>
                  <td className="fw-bold">{r.absent}</td>
                  <td>{r.hours}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
      <div className="small text-muted mt-2">
        Late counts as present. Days before an employee's joining date are not
        counted. Absent is counted only for days that have already passed.
      </div>
    </>
  );
}

function Setup({ version }) {
  const [s, setS] = useState(null),
    [st, setSt] = useState(null),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState("");
  const load = () => {
    api("/attendance/settings").then(setS);
    api("/attendance/status").then(setSt);
  };
  useEffect(load, [version]);
  if (!s) return null;
  const save = async (e) => {
    e.preventDefault();
    try {
      setS(await api("/attendance/settings", "PUT", s));
      setMsg("Saved");
      setErr("");
    } catch (x) {
      setErr(x.message);
      setMsg("");
    }
  };
  const toggle = (i) =>
    setS({
      ...s,
      weekOff: s.weekOff.includes(i)
        ? s.weekOff.filter((x) => x !== i)
        : [...s.weekOff, i],
    });
  return (
    <Row className="g-3">
      <Col lg={6}>
        <Card className="shadow-sm">
          <Card.Body>
            <h6>Rules</h6>
            {err && (
              <Alert variant="danger" className="py-2">
                {err}
              </Alert>
            )}
            {msg && (
              <Alert variant="success" className="py-2">
                {msg}
              </Alert>
            )}
            <Form onSubmit={save}>
              <Form.Group className="mb-3">
                <Form.Label>Office start time</Form.Label>
                <Form.Control
                  type="time"
                  value={s.workStart}
                  onChange={(e) => setS({ ...s, workStart: e.target.value })}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Grace time (minutes after start, still on time)</Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  value={s.graceMin}
                  onChange={(e) => setS({ ...s, graceMin: e.target.value })}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>
                  Two punches closer than this many minutes count as one
                </Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  value={s.minWorkMin}
                  onChange={(e) => setS({ ...s, minWorkMin: e.target.value })}
                />
              </Form.Group>
              <Form.Label>Weekly off days</Form.Label>
              <div className="mb-3">
                {DAYS.map((n, i) => (
                  <Form.Check
                    inline
                    key={n}
                    label={n}
                    checked={s.weekOff.includes(i)}
                    onChange={() => toggle(i)}
                  />
                ))}
              </div>
              <Button type="submit">Save rules</Button>
            </Form>
          </Card.Body>
        </Card>
      </Col>
      <Col lg={6}>
        <Card className="shadow-sm">
          <Card.Body>
            <h6>Machine connection</h6>
            {st && (
              <>
                <div>
                  Last contact from the shop computer:{" "}
                  <b>{ago(st.lastIngestAt)}</b>
                </div>
                <div>
                  Last punch:{" "}
                  <b>
                    {st.lastPunchAt
                      ? new Date(st.lastPunchAt).toLocaleString("en-GB")
                      : "none yet"}
                  </b>
                </div>
                <div>
                  Punches today: <b>{st.punchesToday}</b>
                </div>
                {!st.keySet && (
                  <Alert variant="warning" className="mt-3 mb-0 py-2">
                    ATTENDANCE_KEY is not set on the website yet, so the machine
                    cannot send data. See the guide in the attendance-agent
                    folder.
                  </Alert>
                )}
              </>
            )}
            <div className="small text-muted mt-3">
              The program on the shop computer sends the punches. Staff numbers
              on the machine must match the Employee ID digits (E-0007 is 7) or
              the "Attendance machine ID" typed on the employee.
            </div>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}

export function Attendance() {
  const [tab, setTab] = useState("day"),
    [version, setVersion] = useState(0);
  return (
    <>
      <Nav variant="pills" className="mb-3" activeKey={tab} onSelect={setTab}>
        <Nav.Item>
          <Nav.Link eventKey="day">Daily</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="month">Monthly</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="setup">Rules and machine</Nav.Link>
        </Nav.Item>
      </Nav>
      {tab === "day" && <Day version={version} onChanged={() => setVersion((v) => v + 1)} />}
      {tab === "month" && <Month version={version} />}
      {tab === "setup" && <Setup version={version} />}
    </>
  );
}
