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

// Edit these 3 lines: they print on every cash memo and statement
const SHOP = {
  name: "Madina Glass and Thai Aluminium",
  address: "Thana Road, Chaumuhoni South, Ramu, Cox’s Bazar",
  phone: "01851-235580, 01619-563481, 01821-753879",
};
const LOGO =
  "https://i.postimg.cc/r0L9SS4s/Madina-Glass-Architectural-Logo.png";

export const money = (n) =>
  "৳" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
export const fdate = (d) =>
  new Date(d).toLocaleDateString("en-GB", { timeZone: "UTC" });
const localDay = (d) =>
  new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const today = () => localDay(new Date());
export const COLOR = { Paid: "success", Partial: "warning", Due: "danger" };

export const METHODS = [
  "Cash",
  "Bank",
  "NPBS",
  "Bkash",
  "Nagad",
  "Rocket",
  "QR",
  "Cheque",
  "Other",
];
export const SELLSPERSON = [
  "Helal Uddin",
  "Mohammad Rashid ",
  "Anik Barua",
  "Others",
];
export const MethodSelect = ({ value, onChange, ...rest }) => (
  <Form.Select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    {...rest}
  >
    {METHODS.map((m) => (
      <option key={m}>{m}</option>
    ))}
  </Form.Select>
);

export const SellePersonSelect = ({ value, onChange, ...rest }) => (
  <Form.Select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    {...rest}
  >
    {SELLSPERSON.map((s) => (
      <option key={s}>{s}</option>
    ))}
  </Form.Select>
);

export function PrintModal({ title, onHide, children, extra }) {
  return (
    <Modal show onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="memo">
          <div className="d-flex align-items-center mb-3">
            <img
              src={LOGO}
              alt=""
              style={{ height: 80, maxWidth: 140, objectFit: "contain" }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <div className="text-center flex-grow-1">
              <h3 className="mb-0">{SHOP.name}</h3>
              <div>{SHOP.address}</div>
              <div>{SHOP.phone}</div>
            </div>
            <div style={{ width: 140 }} />
          </div>
          {children}
        </div>
      </Modal.Body>
      <Modal.Footer>
        {extra}
        <Button variant="light" onClick={onHide}>
          Close
        </Button>
        <Button onClick={() => window.print()}>Print</Button>
      </Modal.Footer>
    </Modal>
  );
}

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];
const b100 = (n) =>
  n < 20
    ? ONES[n]
    : TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
const b1000 = (n) =>
  (n >= 100
    ? ONES[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " : "")
    : "") + b100(n % 100);
const words = (x) => {
  let n = Math.round(x);
  if (!n) return "Zero Only";
  const parts = [];
  [
    [1e7, "Crore"],
    [1e5, "Lakh"],
    [1e3, "Thousand"],
  ].forEach(([d, name]) => {
    const q = Math.floor(n / d);
    if (q) {
      parts.push(b1000(q) + " " + name);
      n %= d;
    }
  });
  if (n) parts.push(b1000(n));
  return parts.join(" ") + " Only";
};
const n2 = (x) =>
  Number(x || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function Memo({ s, onHide }) {
  const [info, setInfo] = useState({ prev: 0, pays: [] }),
    [copy, setCopy] = useState("Office Copy");
  useEffect(() => {
    api(`/sales/${s._id}/prev-balance`).then(setInfo);
  }, [s._id]);
  const gross = s.items.reduce((t, l) => t + l.qty * l.price, 0),
    disc = s.items.reduce((t, l) => t + (l.discount || 0), 0);
  const cols = info.pays.length ? info.pays : [{ method: "Cash", amount: 0 }];
  const received = info.pays.reduce((t, x) => t + x.amount, 0),
    totalDue = info.prev + s.total;
  return (
    <PrintModal
      title={`Invoice ${s.invoiceNo}`}
      onHide={onHide}
      extra={
        <Form.Select
          size="sm"
          style={{ width: 150 }}
          value={copy}
          onChange={(e) => setCopy(e.target.value)}
        >
          <option>Office Copy</option>
          <option>Customer Copy</option>
        </Form.Select>
      }
    >
      <div className="text-center fw-bold border-top border-bottom py-1 mb-2">
        Invoice/Bill ({copy})
      </div>
      <Row className="small mb-2">
        <Col>
          Customer Name : <b>{s.client.name}</b> ({s.client.clientId})<br />
          Address : {s.client.address}
          <br />
          Phone : {s.client.phone}
          <br />
          Remarks : {s.note}
        </Col>
        <Col>
          Invoice No : <b>{s.invoiceNo}</b>
          <br />
          Bill Date : {fdate(s.date)}
          <br />
          Sales Person : {s.salesPerson}
          <br />
          Order No : {s.orderNo}
          <br />
          Ledger No : {s.ledgerNo}
        </Col>
      </Row>
      <Table bordered size="sm" className="small">
        <thead>
          <tr>
            <th>SL.</th>
            <th>BRAND</th>
            <th>THK.</th>
            <th>PRODUCT NAME</th>
            <th>COLOR</th>
            <th>SIZE</th>
            <th className="text-end">QTY</th>
            <th className="text-end">RATE</th>
            <th className="text-end">AMOUNT</th>
            <th className="text-end">DISC (৳)</th>
          </tr>
        </thead>
        <tbody>
          {s.items.map((l, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{l.brand}</td>
              <td>{l.thickness}</td>
              <td>{l.name}</td>
              <td>{l.color}</td>
              <td>{l.size}</td>
              <td className="text-end">
                {l.qty} {l.unit}
              </td>
              <td className="text-end">{n2(l.price)}</td>
              <td className="text-end">{n2(l.qty * l.price)}</td>
              <td className="text-end">{n2(l.discount)}</td>
            </tr>
          ))}
          <tr className="fw-bold">
            <td colSpan="8" className="text-end">
              TOTAL :
            </td>
            <td className="text-end">{n2(gross)}</td>
            <td className="text-end">{n2(disc)}</td>
          </tr>
        </tbody>
      </Table>
      <div className="text-end small mb-2">
        TOTAL DISCOUNT : <b>{n2(disc)}</b>
        <br />
        NET PAYABLE : <b>{n2(s.total)}</b>
      </div>
      <Table bordered size="sm" className="small text-center">
        <thead>
          <tr>
            <th colSpan={4 + cols.length}>SUMMARY</th>
          </tr>
          <tr>
            <th rowSpan="2">PREV. BALANCE</th>
            <th rowSpan="2">CURRENT AMOUNT</th>
            <th rowSpan="2">TOTAL DUE</th>
            <th colSpan={cols.length}>MODE OF PAYMENT</th>
            <th rowSpan="2">NET BALANCE</th>
          </tr>
          <tr>
            {cols.map((c) => (
              <th key={c.method}>{c.method.toUpperCase()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{n2(info.prev)}</td>
            <td>{n2(s.total)}</td>
            <td>{n2(totalDue)}</td>
            {cols.map((c) => (
              <td key={c.method}>{n2(c.amount)}</td>
            ))}
            <td className="fw-bold">{n2(totalDue - received)}</td>
          </tr>
        </tbody>
      </Table>
      {/* Table */}
      <div className="small">In Words : {words(s.total)}</div>
      <Row className="mt-5 pt-3 text-center small">
        {["PREPARED BY", "RECEIVED BY", "CHECKED BY", "AUTHORIZED BY"].map(
          (t) => (
            <Col key={t}>
              <div className="border-top pt-1 mx-2">{t}</div>
            </Col>
          ),
        )}
      </Row>
    </PrintModal>
  );
}

function Statement({ id, onHide }) {
  const [d, setD] = useState(null);
  useEffect(() => {
    api(`/clients/${id}/statement`).then(setD);
  }, [id]);
  if (!d) return null;
  const rows = [
    ...d.sales.map((s) => ({
      date: s.date,
      text: `Sale ${s.invoiceNo}`,
      debit: s.total,
      credit: 0,
    })),
    ...d.payments.map((p) => ({
      date: p.date,
      text: `Payment received${p.sale ? " (" + p.sale.invoiceNo + ")" : ""}`,
      debit: 0,
      credit: p.amount,
    })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date));
  let bal = 0;
  const totalSale = d.sales.reduce((s, x) => s + x.total, 0),
    totalPaid = d.payments.reduce((s, x) => s + x.amount, 0);
  return (
    <PrintModal title="Client statement" onHide={onHide}>
      <h5 className="text-center border-top border-bottom py-1">
        ক্লায়েন্ট স্টেটমেন্ট / Client Statement
      </h5>
      <p>
        <b>{d.client.name}</b> ({d.client.clientId}) · {d.client.phone}
        <br />
        {d.client.address}
      </p>
      <Table bordered size="sm">
        <thead>
          <tr>
            <th>Date</th>
            <th>Details</th>
            <th className="text-end">Sale</th>
            <th className="text-end">Paid</th>
            <th className="text-end">Balance due</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            bal += r.debit - r.credit;
            return (
              <tr key={i}>
                <td>{fdate(r.date)}</td>
                <td>{r.text}</td>
                <td className="text-end">{r.debit ? money(r.debit) : ""}</td>
                <td className="text-end">{r.credit ? money(r.credit) : ""}</td>
                <td className="text-end">{money(bal)}</td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <div className="text-end">
        Total sales: {money(totalSale)}
        <br />
        Total paid: {money(totalPaid)}
        <br />
        <b>Total due: {money(totalSale - totalPaid)}</b>
      </div>
    </PrintModal>
  );
}

export function PayModal({ target, onHide, onDone }) {
  const [a, setA] = useState(target.max),
    [d, setD] = useState(today()),
    [mth, setMth] = useState("Cash"),
    [err, setErr] = useState("");
  const go = async (e) => {
    e.preventDefault();
    try {
      await api(target.url, "POST", { amount: a, date: d, method: mth });
      onDone();
    } catch (x) {
      setErr(x.message);
    }
  };
  return (
    <Modal show onHide={onHide} centered>
      <Form onSubmit={go}>
        <Modal.Header closeButton>
          <Modal.Title>{target.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Due now: <b>{money(target.max)}</b>
          </p>
          {err && (
            <Alert variant="danger" className="py-2">
              {err}
            </Alert>
          )}
          <Form.Group className="mb-3">
            <Form.Label>Amount received (৳)</Form.Label>
            <Form.Control
              type="number"
              min="0"
              step="any"
              autoFocus
              value={a}
              onChange={(e) => setA(e.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Date</Form.Label>
            <Form.Control
              type="date"
              value={d}
              onChange={(e) => setD(e.target.value)}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Payment method</Form.Label>
            <MethodSelect value={mth} onChange={setMth} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={onHide}>
            Cancel
          </Button>
          <Button type="submit">Save payment</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function NewSale({ clients, products, onHide, onSaved }) {
  const [f, setF] = useState({
    mode: "old",
    client: "",
    nc: { name: "", phone: "" },
    date: today(),
    paid: "",
    method: "Cash",
    note: "",
    salesPerson: "",
    orderNo: "",
    ledgerNo: "",
  });
  const [items, setItems] = useState([
    { product: "", qty: "", price: "", discount: "" },
  ]);
  const [made, setMade] = useState(null),
    [err, setErr] = useState("");
  const setItem = (i, patch) =>
    setItems(items.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  const pick = (i, id) =>
    setItem(i, {
      product: id,
      price: products.find((p) => p._id === id)?.price ?? "",
    });

  /*   const line = (it) =>
    Math.max(0, (+it.qty || 0) * (+it.price || 0) - (+it.discount || 0)); */
  const gross = (it) => (+it.qty || 0) * (+it.price || 0);
  const disc = (it) =>
    it.dtype === "%"
      ? (gross(it) * (+it.discount || 0)) / 100
      : +it.discount || 0;
  const line = (it) => Math.max(0, gross(it) - disc(it));

  const total = items.reduce((s, it) => s + line(it), 0);
  const save = async (e) => {
    e.preventDefault();
    try {
      let client = f.mode === "new" ? made : f.client;
      if (f.mode === "new" && !client) {
        client = (await api("/clients", "POST", f.nc))._id;
        setMade(client);
      }
      /*  onSaved(
        await api("/sales", "POST", {
          client,
          date: f.date,
          items,
          paid: f.paid,
          method: f.method,
          note: f.note,
          salesPerson: f.salesPerson,
          orderNo: f.orderNo,
          ledgerNo: f.ledgerNo,
        }),
      ); */
      onSaved(
        await api("/sales", "POST", {
          client,
          date: f.date,
          items: items.map((it) => ({
            ...it,
            discount: Math.round(disc(it) * 100) / 100,
          })),
          paid: f.paid,
          method: f.method,
          note: f.note,
          salesPerson: f.salesPerson,
          orderNo: f.orderNo,
          ledgerNo: f.ledgerNo,
        }),
      );
    } catch (x) {
      setErr(x.message);
    }
  };
  return (
    <Modal show onHide={onHide} size="xl" centered>
      <Form onSubmit={save}>
        <Modal.Header closeButton>
          <Modal.Title>New sale</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {err && (
            <Alert variant="danger" className="py-2">
              {err}
            </Alert>
          )}
          <Row className="g-2 mb-3">
            <Col md={3}>
              <Form.Select
                value={f.mode}
                onChange={(e) => setF({ ...f, mode: e.target.value })}
              >
                <option value="old">Existing client</option>
                <option value="new">New client</option>
              </Form.Select>
            </Col>
            {f.mode === "old" ? (
              <Col md={6}>
                <Form.Select
                  required
                  value={f.client}
                  onChange={(e) => setF({ ...f, client: e.target.value })}
                >
                  <option value="">Choose client…</option>
                  {clients.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.clientId} · {c.name} · {c.phone}
                    </option>
                  ))}
                </Form.Select>
              </Col>
            ) : (
              <>
                <Col md={3}>
                  <Form.Control
                    required
                    placeholder="Client name"
                    value={f.nc.name}
                    onChange={(e) =>
                      setF({ ...f, nc: { ...f.nc, name: e.target.value } })
                    }
                  />
                </Col>
                <Col md={3}>
                  <Form.Control
                    required
                    placeholder="Mobile number"
                    value={f.nc.phone}
                    onChange={(e) =>
                      setF({ ...f, nc: { ...f.nc, phone: e.target.value } })
                    }
                  />
                </Col>
              </>
            )}
            <Col md={3}>
              <Form.Control
                type="date"
                required
                value={f.date}
                onChange={(e) => setF({ ...f, date: e.target.value })}
              />
            </Col>
          </Row>
          <Row className="g-2 mb-3">
            <Col md={3}>
              <Form.Control
                placeholder="Order No"
                value={f.orderNo}
                onChange={(e) => setF({ ...f, orderNo: e.target.value })}
              />
            </Col>
            <Col md={3}>
              <Form.Control
                placeholder="Ledger No"
                value={f.ledgerNo}
                onChange={(e) => setF({ ...f, ledgerNo: e.target.value })}
              />
            </Col>
          </Row>
          <Table size="sm" className="align-middle">
            <thead>
              <tr>
                <th style={{ width: "34%" }}>Item</th>
                <th>Qty</th>
                <th>Unit price</th>
                <th>Discount</th>
                <th className="text-end">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td>
                    <Form.Select
                      required
                      value={it.product}
                      onChange={(e) => pick(i, e.target.value)}
                    >
                      <option value="">Choose item…</option>
                      {products.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.label || p.name} (
                          {p.isService
                            ? "service"
                            : `${p.stock} ${p.unit} in stock`}
                          )
                        </option>
                      ))}
                    </Form.Select>
                  </td>
                  <td>
                    <Form.Control
                      type="number"
                      min="0"
                      step="any"
                      value={it.qty}
                      onChange={(e) => setItem(i, { qty: e.target.value })}
                    />
                  </td>
                  <td>
                    <Form.Control
                      type="number"
                      min="0"
                      step="any"
                      value={it.price}
                      onChange={(e) => setItem(i, { price: e.target.value })}
                    />
                  </td>
                  {/* <td>
                    <Form.Control
                      type="number"
                      min="0"
                      step="any"
                      value={it.discount}
                      onChange={(e) => setItem(i, { discount: e.target.value })}
                    />
                  </td> */}
                  <td>
                    <div className="d-flex gap-1">
                      <Form.Control
                        type="number"
                        min="0"
                        step="any"
                        value={it.discount}
                        onChange={(e) =>
                          setItem(i, { discount: e.target.value })
                        }
                      />
                      <Form.Select
                        style={{ width: 64 }}
                        value={it.dtype || "৳"}
                        onChange={(e) => setItem(i, { dtype: e.target.value })}
                      >
                        <option>৳</option>
                        <option>%</option>
                      </Form.Select>
                    </div>
                  </td>
                  <td className="text-end">{money(line(it))}</td>
                  <td>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      disabled={items.length < 2}
                      onClick={() => setItems(items.filter((_, k) => k !== i))}
                    >
                      ×
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Button
            size="sm"
            variant="outline-primary"
            onClick={() =>
              setItems([
                ...items,
                { product: "", qty: "", price: "", discount: "" },
              ])
            }
          >
            Add another item
          </Button>
          <Row className="g-2 mt-3 align-items-end">
            <Col md={5}>
              <Form.Control
                className="mb-2"
                placeholder="Remarks (optional), e.g. VARA - 2000"
                value={f.note}
                onChange={(e) => setF({ ...f, note: e.target.value })}
              />
              {/*               <Form.Control
                placeholder="Sales person (optional)"
                value={f.salesPerson}
                onChange={(e) => setF({ ...f, salesPerson: e.target.value })}
              /> */}
              <SellePersonSelect
                className="mt-1"
                value={f.salesPerson}
                onChange={(v) => setF({ ...f, salesPerson: v })}
              />
            </Col>
            <Col md={3}>
              <Form.Label className="mb-0">Paid now (৳)</Form.Label>
              <Form.Control
                type="number"
                min="0"
                step="any"
                value={f.paid}
                onChange={(e) => setF({ ...f, paid: e.target.value })}
              />
              <MethodSelect
                className="mt-1"
                value={f.method}
                onChange={(v) => setF({ ...f, method: v })}
              />
            </Col>
            <Col md={4} className="text-end">
              Total <b>{money(total)}</b>
              <br />
              Due <b className="text-danger">{money(total - (+f.paid || 0))}</b>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={onHide}>
            Cancel
          </Button>
          <Button type="submit">Save and preview memo</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function Materials({ sale, products, onHide }) {
  const [s, setS] = useState(sale),
    [f, setF] = useState({ product: "", qty: "" }),
    [err, setErr] = useState("");
  const [list, setList] = useState(products);
  const refresh = () => api("/products").then(setList);
  const add = async (e) => {
    e.preventDefault();
    try {
      setS(await api(`/sales/${s._id}/materials`, "POST", f));
      setF({ product: "", qty: "" });
      setErr("");
      refresh();
    } catch (x) {
      setErr(x.message);
    }
  };
  const remove = async (m) => {
    try {
      setS(await api(`/sales/${s._id}/materials/${m._id}`, "DELETE"));
      refresh();
    } catch (x) {
      setErr(x.message);
    }
  };
  const mats = s.materials || [];
  return (
    <Modal show onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Materials used: {s.invoiceNo}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert variant="light" className="border py-2">
          Contract amount <b>{money(s.total)}</b> stays the same. Materials only
          reduce stock.
        </Alert>
        {err && (
          <Alert variant="danger" className="py-2">
            {err}
          </Alert>
        )}
        <Form onSubmit={add}>
          <Row className="g-2 mb-3">
            <Col md={7}>
              <Form.Select
                required
                value={f.product}
                onChange={(e) => setF({ ...f, product: e.target.value })}
              >
                <option value="">Choose product…</option>
                {list
                  .filter((p) => !p.isService)
                  .map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.label || p.name} ({p.stock} {p.unit} in stock)
                    </option>
                  ))}
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Control
                type="number"
                min="0"
                step="any"
                required
                placeholder="Quantity"
                value={f.qty}
                onChange={(e) => setF({ ...f, qty: e.target.value })}
              />
            </Col>
            <Col md={2}>
              <Button type="submit" className="w-100">
                Add
              </Button>
            </Col>
          </Row>
        </Form>
        <Table size="sm">
          <thead>
            <tr>
              <th>Material</th>
              <th className="text-end">Qty</th>
              <th className="text-end">Sell value</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {mats.map((m) => (
              <tr key={m._id}>
                <td>{m.name}</td>
                <td className="text-end">
                  {m.qty} {m.unit}
                </td>
                <td className="text-end">{money(m.qty * m.price)}</td>
                <td className="text-end">
                  <Button
                    size="sm"
                    variant="outline-danger"
                    onClick={() => remove(m)}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
            {!mats.length && (
              <tr>
                <td colSpan="4" className="text-center text-muted py-3">
                  No materials added yet.
                </td>
              </tr>
            )}
          </tbody>
          {!!mats.length && (
            <tfoot>
              <tr className="fw-bold">
                <td colSpan="2">
                  Sell value of materials (not added to the sale)
                </td>
                <td className="text-end">
                  {money(mats.reduce((t, m) => t + m.qty * m.price, 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </Table>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="light" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export function Sales() {
  const [rows, setRows] = useState([]),
    [clients, setClients] = useState([]),
    [products, setProducts] = useState([]);
  const [fl, setFl] = useState({ q: "", from: "", to: "", status: "" });
  const [adding, setAdding] = useState(
      window.location.search.includes("new=1"),
    ),
    [memo, setMemo] = useState(null),
    [pay, setPay] = useState(null),
    [stmt, setStmt] = useState(null),
    [err, setErr] = useState("");
  const [mat, setMat] = useState(null);
  const load = () =>
    api("/sales?" + new URLSearchParams(fl))
      .then(setRows)
      .catch((e) => setErr(e.message));
  const loadLists = () =>
    Promise.all([api("/clients"), api("/products")]).then(([c, p]) => {
      setClients(c);
      setProducts(p);
    });
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [fl]);
  useEffect(() => {
    loadLists();
  }, []);

  const range = (k) => {
    if (k === "all") return setFl({ ...fl, from: "", to: "" });
    const d = new Date();
    if (k === "week") d.setDate(d.getDate() - 6);
    if (k === "month") d.setDate(1);
    setFl({ ...fl, from: k === "today" ? today() : localDay(d), to: today() });
  };
  const del = async (s) => {
    if (
      !confirm(
        `Delete ${s.invoiceNo}? Stock and payments of this sale will be reversed.`,
      )
    )
      return;
    try {
      await api(`/sales/${s._id}`, "DELETE");
      load();
      loadLists();
    } catch (x) {
      setErr(x.message);
    }
  };
  const exportCsv = () => {
    const head = [
      "Invoice",
      "Date",
      "Client ID",
      "Client",
      "Phone",
      "Total",
      "Paid",
      "Due",
      "Status",
    ];
    const lines = rows.map((s) => [
      s.invoiceNo,
      fdate(s.date),
      s.client?.clientId,
      s.client?.name,
      s.client?.phone,
      s.total,
      s.paid,
      s.due,
      s.status,
    ]);
    const csv = [head, ...lines]
      .map((r) =>
        r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob(["\ufeff" + csv], { type: "text/csv" }),
    );
    a.download = "sales.csv";
    a.click();
  };
  const sum = (k) => rows.reduce((s, x) => s + x[k], 0);

  return (
    <>
      <Row className="mb-3 g-2 align-items-center">
        <Col>
          <h4 className="mb-0">Sales</h4>
        </Col>
        <Col xs="auto">
          <Button variant="outline-secondary" onClick={exportCsv}>
            Export Excel (CSV)
          </Button>
        </Col>
        <Col xs="auto">
          <Button onClick={() => setAdding(true)}>New sale</Button>
        </Col>
      </Row>
      <Row className="g-2 mb-3">
        <Col md={3}>
          <Form.Control
            placeholder="Search invoice, name, phone, client ID"
            value={fl.q}
            onChange={(e) => setFl({ ...fl, q: e.target.value })}
          />
        </Col>
        <Col md={2}>
          <Form.Control
            type="date"
            value={fl.from}
            onChange={(e) => setFl({ ...fl, from: e.target.value })}
          />
        </Col>
        <Col md={2}>
          <Form.Control
            type="date"
            value={fl.to}
            onChange={(e) => setFl({ ...fl, to: e.target.value })}
          />
        </Col>
        <Col md={2}>
          <Form.Select
            value={fl.status}
            onChange={(e) => setFl({ ...fl, status: e.target.value })}
          >
            <option value="">All status</option>
            <option>Paid</option>
            <option>Partial</option>
            <option>Due</option>
          </Form.Select>
        </Col>
        <Col md={3} className="d-flex gap-1">
          {[
            ["today", "Today"],
            ["week", "7 days"],
            ["month", "This month"],
            ["all", "All"],
          ].map(([k, l]) => (
            <Button
              key={k}
              size="sm"
              variant="outline-primary"
              onClick={() => range(k)}
            >
              {l}
            </Button>
          ))}
        </Col>
      </Row>
      {err && (
        <Alert variant="danger" dismissible onClose={() => setErr("")}>
          {err}
        </Alert>
      )}
      <Card className="shadow-sm">
        <div className="table-responsive">
          <Table hover className="mb-0">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Date</th>
                <th>Client</th>
                <th className="text-end">Total</th>
                <th className="text-end">Paid</th>
                <th className="text-end">Due</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s._id}>
                  <td>
                    <b>{s.invoiceNo}</b>
                  </td>
                  <td>{fdate(s.date)}</td>
                  <td>
                    {s.client?.name}
                    <div className="small text-muted">
                      {s.client?.clientId} · {s.client?.phone}
                    </div>
                  </td>
                  <td className="text-end">{money(s.total)}</td>
                  <td className="text-end">{money(s.paid)}</td>
                  <td className="text-end">{money(s.due)}</td>
                  <td>
                    <Badge bg={COLOR[s.status]}>{s.status}</Badge>
                  </td>
                  <td className="text-end text-nowrap">
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      className="me-1"
                      onClick={() => setMemo(s)}
                    >
                      Memo
                    </Button>
                    {s.items.some((l) => l.isContract) && (
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        className="me-1"
                        onClick={() => setMat(s)}
                      >
                        Materials
                      </Button>
                    )}
                    {s.due > 0 && (
                      <Button
                        size="sm"
                        className="me-1"
                        onClick={() =>
                          setPay({
                            title: `Payment for ${s.invoiceNo}`,
                            max: s.due,
                            url: `/sales/${s._id}/payments`,
                          })
                        }
                      >
                        Receive
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      className="me-1"
                      onClick={() => setStmt(s.client._id)}
                    >
                      Statement
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => del(s)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan="8" className="text-center text-muted py-4">
                    No sales found. Click "New sale" to add one.
                  </td>
                </tr>
              )}
            </tbody>
            {!!rows.length && (
              <tfoot>
                <tr className="fw-bold">
                  <td colSpan="3">Total ({rows.length} sales)</td>
                  <td className="text-end">{money(sum("total"))}</td>
                  <td className="text-end">{money(sum("paid"))}</td>
                  <td className="text-end">{money(sum("due"))}</td>
                  <td colSpan="2" />
                </tr>
              </tfoot>
            )}
          </Table>
        </div>
      </Card>
      {adding && (
        <NewSale
          clients={clients}
          products={products}
          onHide={() => setAdding(false)}
          onSaved={(s) => {
            setAdding(false);
            setMemo(s);
            load();
            loadLists();
          }}
        />
      )}
      {memo && <Memo s={memo} onHide={() => setMemo(null)} />}
      {mat && (
        <Materials
          sale={mat}
          products={products}
          onHide={() => {
            setMat(null);
            load();
            loadLists();
          }}
        />
      )}
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
      {stmt && <Statement id={stmt} onHide={() => setStmt(null)} />}
    </>
  );
}

/* export function Dues() {
  const [rows, setRows] = useState([]), [pay, setPay] = useState(null), [stmt, setStmt] = useState(null);
  const load = () => api('/dues').then(setRows);
  useEffect(() => { load(); }, []);
  const age = d => Math.floor((Date.now() - new Date(d)) / 864e5);
  return (
    <>
      <Row className="mb-3 align-items-center"><Col><h4 className="mb-0">Client dues</h4></Col>
        <Col xs="auto" className="fs-5">Total due: <b>{money(rows.reduce((s, r) => s + r.due, 0))}</b></Col></Row>
      <Card className="shadow-sm"><div className="table-responsive">
        <Table hover className="mb-0">
          <thead><tr><th>Client</th><th className="text-end">Total due</th><th>Unpaid invoices</th><th>Oldest due</th><th /></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.client._id}>
                <td><b>{r.client.name}</b><div className="small text-muted">{r.client.clientId} · {r.client.phone}</div></td>
                <td className="text-end fw-bold">{money(r.due)}</td><td>{r.invoices}</td>
                <td>{age(r.oldest)} days {age(r.oldest) > 30 && <Badge bg="danger">Old</Badge>}</td>
                <td className="text-end text-nowrap">
                  <Button size="sm" className="me-1" onClick={() => setPay({ title: `Payment from ${r.client.name}`, max: r.due, url: `/clients/${r.client._id}/pay` })}>Receive payment</Button>
                  <Button size="sm" variant="outline-secondary" onClick={() => setStmt(r.client._id)}>Statement</Button>
                </td>
              </tr>))}
            {!rows.length && <tr><td colSpan="5" className="text-center text-muted py-4">No dues. Every client has paid in full.</td></tr>}
          </tbody>
        </Table>
      </div></Card>
      {pay && <PayModal target={pay} onHide={() => setPay(null)} onDone={() => { setPay(null); load(); }} />}
      {stmt && <Statement id={stmt} onHide={() => setStmt(null)} />}
    </>
  );
}
 */
/* const SMS_TEXT = `Dear {name}, your due at ${SHOP.name} is {due} BDT. Please pay soon. Call ${SHOP.phone.split(",")[0].trim()}`; */
const SMS_TEXT = `প্রিয় {name}, Madina Glass and Thai Aluminium-এ আপনার বকেয়া {due} টাকা। অনুগ্রহ করে দ্রুত পরিশোধ করুন। যোগাযোগ: ${SHOP.phone.split(",")[0].trim()}`;
const CALL_TEXT = `Hello {name}. This is a payment reminder from ${SHOP.name}. Your due amount is {due} taka. Please pay at your earliest convenience.`;

export function Dues() {
  const [rows, setRows] = useState([]),
    [pay, setPay] = useState(null),
    [stmt, setStmt] = useState(null);
  /*   const [sel, setSel] = useState({}), [msg, setMsg] = useState(null), [out, setOut] = useState(null); */
  const [sel, setSel] = useState({}),
    [msg, setMsg] = useState(null),
    [out, setOut] = useState(null),
    [bal, setBal] = useState("");
  const load = () => api("/dues").then(setRows);
  useEffect(() => {
    load();
  }, []);
  const age = (d) => Math.floor((Date.now() - new Date(d)) / 864e5);
  /*   const checkBal = async () => {
    setBal("Checking…");
    try {
      const r = await api("/sms-balance");
      setBal(
        r.balance !== null
          ? `SMS balance: ${r.balance}`
          : `Gateway reply: ${r.raw}`,
      );
    } catch (x) {
      setBal(x.message);
    }
  }; */

  const checkBal = async () => {
    setBal("Checking…");
    try {
      const r = await api("/sms-balance");
      setBal(
        `SMS: ${r.sms != null ? "৳" + r.sms : r.smsError} · Voice: ${r.voice ?? r.voiceError}`,
      );
    } catch (x) {
      setBal(x.message);
    }
  };

  const picked = rows.filter((r) => sel[r.client._id]);
  const toggleAll = () =>
    setSel(
      picked.length === rows.length
        ? {}
        : Object.fromEntries(rows.map((r) => [r.client._id, true])),
    );
  const open = (channel) =>
    setMsg({
      channel,
      text: channel === "sms" ? SMS_TEXT : CALL_TEXT,
      sending: false,
      err: "",
    });
  const send = async () => {
    setMsg({ ...msg, sending: true, err: "" });
    try {
      const r = await api("/dues/notify", "POST", {
        clientIds: picked.map((p) => p.client._id),
        channel: msg.channel,
        template: msg.text,
      });
      setOut({ channel: msg.channel, results: r.results });
      setMsg(null);
    } catch (x) {
      setMsg({ ...msg, sending: false, err: x.message });
    }
  };
  const sample = picked[0];
  const preview =
    sample && msg
      ? msg.text
          .replaceAll("{name}", sample.client.name)
          .replaceAll("{due}", sample.due)
      : "";
  return (
    <>
      <Row className="mb-3 g-2 align-items-center">
        <Col>
          <h4 className="mb-0">Client dues</h4>
        </Col>
        <Col xs="auto" className="fs-5">
          Total due: <b>{money(rows.reduce((s, r) => s + r.due, 0))}</b>
        </Col>
        <Col xs="auto">
          <Button size="sm" variant="outline-secondary" onClick={checkBal}>
            Check SMS balance
          </Button>
          <span className="small text-muted ms-2">{bal}</span>
        </Col>
        <Col xs="auto">
          <Button
            variant="outline-primary"
            disabled={!picked.length}
            onClick={() => open("sms")}
          >
            Send SMS ({picked.length})
          </Button>
        </Col>
        <Col xs="auto">
          <Button
            variant="outline-primary"
            disabled={!picked.length}
            onClick={() => open("call")}
          >
            Voice call ({picked.length})
          </Button>
        </Col>
      </Row>
      <Card className="shadow-sm">
        <div className="table-responsive">
          <Table hover className="mb-0">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <Form.Check
                    checked={!!rows.length && picked.length === rows.length}
                    onChange={toggleAll}
                  />
                </th>
                <th>Client</th>
                <th className="text-end">Total due</th>
                <th>Unpaid invoices</th>
                <th>Oldest due</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.client._id}>
                  <td>
                    <Form.Check
                      checked={!!sel[r.client._id]}
                      onChange={(e) =>
                        setSel({ ...sel, [r.client._id]: e.target.checked })
                      }
                    />
                  </td>
                  <td>
                    <b>{r.client.name}</b>
                    <div className="small text-muted">
                      {r.client.clientId} · {r.client.phone}
                    </div>
                  </td>
                  <td className="text-end fw-bold">{money(r.due)}</td>
                  <td>{r.invoices}</td>
                  <td>
                    {age(r.oldest)} days{" "}
                    {age(r.oldest) > 30 && <Badge bg="danger">Old</Badge>}
                  </td>
                  <td className="text-end text-nowrap">
                    <Button
                      size="sm"
                      className="me-1"
                      onClick={() =>
                        setPay({
                          title: `Payment from ${r.client.name}`,
                          max: r.due,
                          url: `/clients/${r.client._id}/pay`,
                        })
                      }
                    >
                      Receive payment
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      onClick={() => setStmt(r.client._id)}
                    >
                      Statement
                    </Button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan="6" className="text-center text-muted py-4">
                    No dues. Every client has paid in full.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      </Card>

      {msg && (
        <Modal show onHide={() => setMsg(null)} centered>
          <Modal.Header closeButton>
            <Modal.Title>
              {msg.channel === "sms" ? "Send SMS" : "Voice call"} to{" "}
              {picked.length} client(s)
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {msg.err && (
              <Alert variant="danger" className="py-2">
                {msg.err}
              </Alert>
            )}
            {msg.channel === "sms" ? (
              <>
                <Form.Label>
                  Message (use {"{name}"} and {"{due}"})
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  value={msg.text}
                  onChange={(e) => setMsg({ ...msg, text: e.target.value })}
                />
                <div className="small text-muted mt-2">
                  Preview for {sample?.client.name}: {preview}
                </div>
                <div className="small text-muted">
                  {msg.text.length} characters
                </div>
              </>
            ) : (
              <div>
                Your saved audio message (the same recording for everyone) will
                be played to the {picked.length} selected client(s). It cannot
                include a name or an amount.
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setMsg(null)}>
              Cancel
            </Button>
            <Button disabled={msg.sending} onClick={send}>
              {msg.sending ? "Sending…" : "Send now"}
            </Button>
          </Modal.Footer>
        </Modal>
      )}

      {out && (
        <Modal show onHide={() => setOut(null)} centered>
          <Modal.Header closeButton>
            <Modal.Title>
              {out.channel === "sms" ? "SMS" : "Call"} result
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {out.results.map((x, i) => (
              <div key={i} className="mb-2">
                <b>{x.client}</b> ({x.phone}):{" "}
                {x.ok ? (
                  <span className="text-success">Sent</span>
                ) : (
                  <span className="text-danger">{x.error}</span>
                )}
                {x.ok && x.detail && (
                  <div className="small text-muted">{x.detail}</div>
                )}
              </div>
            ))}
          </Modal.Body>
        </Modal>
      )}

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
      {stmt && <Statement id={stmt} onHide={() => setStmt(null)} />}
    </>
  );
}
