import { Fragment, useEffect, useRef, useState } from "react";
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
import OptionSelect from "./OptionSelect.jsx";
import {
  GRADES,
  blankSize,
  fmtFt,
  serviceCalc,
  sizeCalc,
} from "./serviceLib.js";

// Edit these 3 lines: they print on every cash memo and statement
const SHOP = {
  name: "Madina Glass and Thai Aluminium",
  address: "Thana Road, Chaumuhoni South, Ramu, Cox’s Bazar",
  phone: "01851-235580, 01619-563481, 01821-753879",
};
const LOGO =
  "https://i.postimg.cc/r0L9SS4s/Madina-Glass-Architectural-Logo.png";


const toBold = (str) =>
  [...String(str)]
    .map((ch) => {
      const c = ch.charCodeAt(0);
      if (c >= 48 && c <= 57) return String.fromCodePoint(0x1d7ce + (c - 48)); // 0-9
      if (c >= 65 && c <= 90) return String.fromCodePoint(0x1d400 + (c - 65)); // A-Z
      if (c >= 97 && c <= 122) return String.fromCodePoint(0x1d41a + (c - 97)); // a-z
      return ch;
    })
    .join("");
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

export function PrintModal({ title, onHide, children, extra, size = "lg" }) {
  // Print date & time: shown only on paper, written at the moment of printing
  const stampRef = useRef(null);
  useEffect(() => {
    const stamp = () => {
      if (stampRef.current)
        stampRef.current.textContent =
          "Printed: " +
          new Date().toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          });
    };
    window.addEventListener("beforeprint", stamp);
    return () => window.removeEventListener("beforeprint", stamp);
  }, []);
  return (
    <Modal show onHide={onHide} size={size} centered>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="memo">
          <div className="print-stamp" ref={stampRef} />
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

// One line per window size when a service has more than one size; otherwise the single value
/* const stack = (l, f, single) =>
  l.sizes?.length > 1
    ? l.sizes.map((z, k) => <div key={k}>{f(z)}</div>)
    : single;
 */
const stack = (l, f, single) =>
  l.sizes?.length > 1
    ? l.sizes.map((z, k) => (
        <div key={k} className="size-line">
          {f(z)}
        </div>
      ))
    : single;


// Invoice columns. Each entry is [heading, how to show a line, right-aligned?]
const PRODUCT_COLS = [
  ["SL.", (l, i) => i + 1],
  ["BRAND", (l) => l.brand],
  ["SIZE", (l) => l.size],
  ["THK.", (l) => l.thickness],
  ["PRODUCT NAME", (l) => l.name],
  ["GRADE", (l) => l.grade],
  ["COLOR", (l) => l.color],
  ["LTH", (l) => l.lth ?? ""],
  ["WTH", (l) => l.wth ?? ""],
  ["PCS", (l) => l.pcs ?? ""],
  ["QTY", (l) => `${l.qty} ${l.unit || ""}`, true],
  ["RATE", (l) => n2(l.price), true],
  ["AMOUNT", (l) => n2(l.qty * l.price), true],
  ["DISC (৳)", (l) => n2(l.discount), true],
];
// Customer invoice of a Service Sale: sizes are shown in feet (0.5 ft steps)
const SERVICE_COLS = [
  ["SL.", (l, i) => i + 1],
  ["BRAND", (l) => l.brand],
  ["SIZE", (l) => l.size],
  ["THK. (MM)", (l) => l.thickness],
  ["SERVICE NAME", (l) => l.name],
  ["COLOR", (l) => l.color],
  ["GRADE", (l) => l.grade],
  ["LTH (FT)", (l) => stack(l, (z) => fmtFt(z.lthFt), fmtFt(l.lthFt))],
  ["WTH (FT)", (l) => stack(l, (z) => fmtFt(z.wthFt), fmtFt(l.wthFt))],
  ["PCS", (l) => stack(l, (z) => z.pcs ?? "", l.pcs ?? "")],
  ["QTY", (l) => `${l.qty} ${l.unit || ""}`, true],
  ["RATE", (l) => n2(l.price), true],
  ["AMOUNT", (l) => n2(l.qty * l.price), true],
  ["DISC (৳)", (l) => n2(l.discount), true],
];
// Mistry memo: no prices, and the size stays in the original MM
const MISTRY_COLS = [
  ["SL.", (l, i) => i + 1],
  ["BRAND", (l) => l.brand],
  ["SIZE", (l) => l.size],
  ["THK. (MM)", (l) => l.thickness],
  ["SERVICE NAME", (l) => l.name],
  ["COLOR", (l) => l.color],
  ["GRADE", (l) => l.grade],
  ["LTH (MM)", (l) => stack(l, (z) => z.lthMm ?? "", l.lthMm ?? ""), true],
  ["WTH (MM)", (l) => stack(l, (z) => z.wthMm ?? "", l.wthMm ?? ""), true],
  ["PCS", (l) => stack(l, (z) => z.pcs ?? "", l.pcs ?? ""), true],
  [
    "QTY (SQ FT)",
    (l) =>
      l.sizes?.length > 1 ? (
        <>
          {l.sizes.map((z, k) => (
            <div key={k} className="size-line">
              {z.qty}
            </div>
          ))}
          <div className="fw-bold">{l.qty}</div>
        </>
      ) : (
        l.qty
      ),
    true,
  ],
];

function Memo({ s, onHide, onMistry }) {
  const isService = s.saleType === "service",
    cols = isService ? SERVICE_COLS : PRODUCT_COLS;
  const [info, setInfo] = useState({ prev: 0, pays: [], returned: 0, refunded: 0, waived: 0 }),
    [copy, setCopy] = useState("Office Copy");
  useEffect(() => {
    api(`/sales/${s._id}/prev-balance`).then(setInfo);
  }, [s._id]);
  const gross = s.items.reduce((t, l) => t + l.qty * l.price, 0),
    disc = s.items.reduce((t, l) => t + (l.discount || 0), 0);
  const payCols = info.pays.length
    ? info.pays
    : [{ method: "Cash", amount: 0 }];
  const received = info.pays.reduce((t, x) => t + x.amount, 0),
    totalDue = info.prev + s.total;
  return (
    <PrintModal
      size="xl"
      title={`Invoice ${s.invoiceNo}`}
      onHide={onHide}
      extra={
        <>
          {isService && onMistry && (
            <Button size="sm" variant="outline-secondary" onClick={onMistry}>
              Mistry memo
            </Button>
          )}
          <Form.Select
            size="sm"
            style={{ width: 150 }}
            value={copy}
            onChange={(e) => setCopy(e.target.value)}
          >
            <option>Office Copy</option>
            <option>Customer Copy</option>
          </Form.Select>
        </>
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
      <Table bordered size="sm" className="memo-table">
        <thead>
          <tr>
            {cols.map(([h, , end]) => (
              <th key={h} className={end ? "text-end" : ""}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {s.items.map((l, i) => (
            <tr key={i}>
              {cols.map(([h, show, end]) => (
                <td key={h} className={end ? "text-end" : ""}>
                  {show(l, i)}
                </td>
              ))}
            </tr>
          ))}
          <tr className="fw-bold">
            <td colSpan={cols.length - 2} className="text-end">
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
        {info.returned > 0 && (
          <>
            <br />
            LESS RETURNS : <b>{n2(info.returned)}</b>
          </>
        )}
        {info.waived > 0 && (
          <>
            <br />
            LESS WAIVED (MOUKUF) : <b>{n2(info.waived)}</b>
          </>
        )}
      </div>
      <Table bordered size="sm" className="small text-center">
        <thead>
          <tr>
            <th colSpan={4 + payCols.length}>SUMMARY</th>
          </tr>
          <tr>
            <th rowSpan="2">PREV. BALANCE</th>
            <th rowSpan="2">CURRENT AMOUNT</th>
            <th rowSpan="2">TOTAL DUE</th>
            <th colSpan={payCols.length}>MODE OF PAYMENT</th>
            <th rowSpan="2">NET BALANCE</th>
          </tr>
          <tr>
            {payCols.map((c) => (
              <th key={c.method}>{c.method.toUpperCase()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{n2(info.prev)}</td>
            <td>{n2(s.total)}</td>
            <td>{n2(totalDue)}</td>
            {payCols.map((c) => (
              <td key={c.method}>{n2(c.amount)}</td>
            ))}
            <td className="fw-bold">
              {n2(totalDue - received - (info.returned || 0) - (info.waived || 0) + (info.refunded || 0))}
            </td>
          </tr>
        </tbody>
      </Table>
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

// Memo for the mistry (worker): service details only, in the original MM, with no prices
function MistryMemo({ s, onHide }) {
  const pcs = s.items.reduce((t, l) => t + (l.pcs || 0), 0),
    qty = s.items.reduce((t, l) => t + (l.qty || 0), 0);
  return (
    <PrintModal size="xl" title={`Mistry memo ${s.invoiceNo}`} onHide={onHide}>
      <div className="text-center fw-bold border-top border-bottom py-1 mb-2">
        Mistry Memo / Work Order
      </div>
      <Row className="small mb-2">
        <Col>
          Customer Name : <b>{s.client.name}</b> ({s.client.clientId})<br />
          Address : {s.client.address}
          <br />
          Phone : {s.client.phone}
        </Col>
        <Col>
          Invoice No : <b>{s.invoiceNo}</b>
          <br />
          Date : {fdate(s.date)}
        </Col>
      </Row>
      <Table bordered size="sm" className="memo-table">
        <thead>
          <tr>
            {MISTRY_COLS.map(([h, , end]) => (
              <th key={h} className={end ? "text-end" : ""}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {s.items.map((l, i) => (
            <tr key={i}>
              {MISTRY_COLS.map(([h, show, end]) => (
                <td key={h} className={end ? "text-end" : ""}>
                  {show(l, i)}
                </td>
              ))}
            </tr>
          ))}
          <tr className="fw-bold">
            <td colSpan={MISTRY_COLS.length - 2} className="text-end">
              TOTAL :
            </td>
            <td className="text-end">{pcs}</td>
            <td className="text-end">{Math.round(qty * 100) / 100}</td>
          </tr>
        </tbody>
      </Table>
      <div className="small text-muted">
        Sizes are in the original MM (304.8 MM = 1 FT).
      </div>
      <Row className="mt-5 pt-3 text-center small">
        {["PREPARED BY", "MISTRY / RECEIVED BY", "AUTHORIZED BY"].map((t) => (
          <Col key={t}>
            <div className="border-top pt-1 mx-2">{t}</div>
          </Col>
        ))}
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
    ...(d.opening
      ? [
          {
            date: d.opening.date,
            text: "Opening balance (before this system)",
            debit: d.opening.amount,
            credit: 0,
          },
        ]
      : []),
    ...d.sales.map((s) => ({
      date: s.date,
      text: `Sale ${s.invoiceNo}`,
      debit: s.total,
      credit: 0,
    })),
    ...d.payments.map((p) => ({
      date: p.date,
      text:
        p.kind === "refund"
          ? `Refund paid back (${p.sale?.invoiceNo || ""})`
          : p.kind === "credit"
            ? `Exchange credit (${p.sale?.invoiceNo || ""})`
            : `Payment received${p.sale ? " (" + p.sale.invoiceNo + ")" : " (opening balance)"}`,
      debit: 0,
      credit: p.amount,
    })),
    ...d.sales
      .filter((x) => x.waived > 0)
      .map((x) => ({
        date: x.waivedAt || x.date,
        text: `Waived / Moukuf (${x.invoiceNo})${x.waivedNote ? " - " + x.waivedNote : ""}`,
        debit: 0,
        credit: x.waived,
      })),
    ...(d.returns || []).map((r) => ({
      date: r.date,
      text: `Return ${r.returnNo}`,
      debit: 0,
      credit: r.total,
    })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date));
  let bal = 0;
  const totalSale =
      d.sales.reduce((s, x) => s + x.total, 0) + (d.opening?.amount || 0),
    totalPaid =
      d.payments.reduce((s, x) => s + x.amount, 0) +
      (d.returns || []).reduce((s, x) => s + x.total, 0) + // returned goods reduce what is owed
      d.sales.reduce((s, x) => s + (x.waived || 0), 0); // so does a Moukuf
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
        Total sales{d.opening ? " + opening balance" : ""}: {money(totalSale)}
        <br />
        Total paid{d.returns?.length ? " + returns" : ""}
        {d.sales.some((x) => x.waived > 0) ? " + waived" : ""}: {money(totalPaid)}
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

// Parts shared by Product Sale and Service Sale
const newSaleState = () => ({
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

// A new client is created together with the sale; "made" remembers it so a retry does not create it twice
const ensureClient = async (f, made, setMade) => {
  let client = f.mode === "new" ? made : f.client;
  if (f.mode === "new" && !client) {
    client = (await api("/clients", "POST", f.nc))._id;
    setMade(client);
  }
  return client;
};

function SaleHeader({ f, setF, clients }) {
  return (
    <>
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
    </>
  );
}

function SaleFooter({ f, setF, total }) {
  return (
    <Row className="g-2 mt-3 align-items-end">
      <Col md={5}>
        <Form.Control
          className="mb-2"
          placeholder="Remarks (optional), e.g. VARA - 2000"
          value={f.note}
          onChange={(e) => setF({ ...f, note: e.target.value })}
        />
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
  );
}

const blankProductRow = () => ({
  product: "",
  brand: "",
  size: "",
  thickness: "",
  grade: "",
  color: "",
  lth: "",
  wth: "",
  pcs: "",
  qty: "",
  price: "",
  discount: "",
  dtype: "৳",
});

// Product Sale: stock goes down by QTY (in the product's own unit)
function NewSale({ clients, products, onHide, onSaved }) {
  const [f, setF] = useState(newSaleState());
  const [items, setItems] = useState([blankProductRow()]);
  const [made, setMade] = useState(null),
    [err, setErr] = useState("");
  const setItem = (i, patch) =>
    setItems(items.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  // Choosing a product fills Brand, Size, Thick, Grade, Color and Rate. The operator can still change them.
  const pick = (i, id) => {
    const p = products.find((x) => x._id === id);
    setItem(
      i,
      p
        ? {
            product: id,
            brand: p.brand || "",
            size: p.size || "",
            thickness: p.thickness || "",
            grade: p.grade || "",
            color: p.color || "",
            lth: p.lth ?? "",
            wth: p.wth ?? "",
            pcs: "", // PCS is typed by the operator; it comes off the product's PCS stock
            price: p.price ?? "",
          }
        : {
            product: "",
            brand: "",
            size: "",
            thickness: "",
            grade: "",
            color: "",
            lth: "",
            wth: "",
            pcs: "",
            price: "",
          },
    );
  };

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
      const client = await ensureClient(f, made, setMade);
      onSaved(
        await api("/sales", "POST", {
          saleType: "product",
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

  const txt = (i, k, w = 70, props = {}) => (
    <td>
      <Form.Control
        size="sm"
        style={{ minWidth: w }}
        value={items[i][k]}
        onChange={(e) => setItem(i, { [k]: e.target.value })}
        {...props}
      />
    </td>
  );
  const numc = (i, k, w = 70) =>
    txt(i, k, w, { type: "number", min: "0", step: "any" });

  return (
    <Modal show onHide={onHide} fullscreen>
      <Form onSubmit={save}>
        <Modal.Header closeButton>
          <Modal.Title>Product Sale</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {err && (
            <Alert variant="danger" className="py-2">
              {err}
            </Alert>
          )}
          <SaleHeader f={f} setF={setF} clients={clients} />
          <div className="table-responsive">
            <Table size="sm" className="align-middle">
              <thead>
                <tr>
                  <th>SL</th>
                  <th>Brand</th>
                  <th>Size</th>
                  <th>Thick</th>
                  <th>Product Name</th>
                  <th>Grade</th>
                  <th>Color</th>
                  <th>LTH</th>
                  <th>WTH</th>
                  <th>PCS</th>
                  <th>QTY</th>
                  <th>Rate</th>
                  <th className="text-end">Amount</th>
                  <th>Disc</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    {txt(i, "brand", 90)}
                    {txt(i, "size", 80)}
                    {txt(i, "thickness", 60)}
                    <td>
                      <Form.Select
                        size="sm"
                        required
                        style={{ minWidth: 220 }}
                        value={it.product}
                        onChange={(e) => pick(i, e.target.value)}
                      >
                        <option value="">Choose item…</option>
                        {products.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.label || p.name} (
                            {p.isService
                              ? "service"
                              : `${p.stock} ${p.unit}, ${p.pcs || 0} pcs in stock`}
                            )
                          </option>
                        ))}
                      </Form.Select>
                    </td>
                    {txt(i, "grade", 70, { list: "grade-list" })}
                    {txt(i, "color", 80)}
                    {numc(i, "lth", 70)}
                    {numc(i, "wth", 70)}
                    {numc(i, "pcs", 60)}
                    {numc(i, "qty", 80)}
                    {numc(i, "price", 80)}
                    <td className="text-end">{money(gross(it))}</td>
                    <td>
                      <div className="d-flex gap-1" style={{ minWidth: 130 }}>
                        <Form.Control
                          size="sm"
                          type="number"
                          min="0"
                          step="any"
                          value={it.discount}
                          onChange={(e) =>
                            setItem(i, { discount: e.target.value })
                          }
                        />
                        <Form.Select
                          size="sm"
                          style={{ width: 64 }}
                          value={it.dtype || "৳"}
                          onChange={(e) =>
                            setItem(i, { dtype: e.target.value })
                          }
                        >
                          <option>৳</option>
                          <option>%</option>
                        </Form.Select>
                      </div>
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        disabled={items.length < 2}
                        onClick={() =>
                          setItems(items.filter((_, k) => k !== i))
                        }
                      >
                        ×
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <datalist id="grade-list">
            {GRADES.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
          <Button
            size="sm"
            variant="outline-primary"
            onClick={() => setItems([...items, blankProductRow()])}
          >
            Add another item
          </Button>
          <SaleFooter f={f} setF={setF} total={total} />
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

const blankServiceRow = () => ({
  brand: "",
  size: "",
  thickness: "",
  name: "",
  color: "",
  grade: "",
  sizes: [blankSize()],
  price: "",
  discountValue: "",
  discountType: "৳",
});
const blankListingRow = () => ({ product: "", pcs: "", qty: "" });

// Service Sale: the customer gets the service invoice. The Product Listing below it is internal:
// it is what the job uses from stock, and only it reduces stock.
function NewServiceSale({ clients, products, onHide, onSaved }) {
  const [f, setF] = useState(newSaleState());
  const [items, setItems] = useState([blankServiceRow()]);
  const [lst, setLst] = useState([blankListingRow()]);
  const [opts, setOpts] = useState({
    brand: [],
    size: [],
    color: [],
    service: [],
  });
  const [made, setMade] = useState(null),
    [err, setErr] = useState("");

  useEffect(() => {
    ["brand", "size", "color", "service"].forEach((k) =>
      api(`/options?kind=${k}`)
        .then((list) => setOpts((o) => ({ ...o, [k]: list })))
        .catch(() => {}),
    );
  }, []);
  const addOpt = async (kind, value) => {
    const r = await api("/options", "POST", { kind, value });
    setOpts((o) => ({
      ...o,
      [kind]: o[kind].includes(r.value)
        ? o[kind]
        : [...o[kind], r.value].sort((x, y) => x.localeCompare(y)),
    }));
    return r.value;
  };

  const setItem = (i, patch) =>
    setItems(items.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  const setList = (i, patch) =>
    setLst(lst.map((m, k) => (k === i ? { ...m, ...patch } : m)));
  const setSize = (i, j, patch) =>
    setItem(i, {
      sizes: items[i].sizes.map((z, k) => (k === j ? { ...z, ...patch } : z)),
    });
  const calcs = items.map(serviceCalc);
  const total = calcs.reduce((t, c) => t + c.total, 0);
  const stockProducts = products.filter((p) => !p.isService);

  const save = async (e) => {
    e.preventDefault();
    try {
      const client = await ensureClient(f, made, setMade);
      onSaved(
        await api("/sales", "POST", {
          saleType: "service",
          client,
          date: f.date,
          items,
          materials: lst.filter((m) => m.product || m.qty || m.pcs),
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

  const pickOpt = (i, k, w, placeholder, required) => (
    <td style={{ minWidth: w }}>
      <OptionSelect
        value={items[i][k === "service" ? "name" : k]}
        options={opts[k]}
        placeholder={placeholder}
        required={required}
        onChange={(v) => setItem(i, { [k === "service" ? "name" : k]: v })}
        onCreate={(v) => addOpt(k, v)}
      />
    </td>
  );
  const input = (i, k, w, props = {}) => (
    <td>
      <Form.Control
        size="sm"
        style={{ minWidth: w }}
        value={items[i][k]}
        onChange={(e) => setItem(i, { [k]: e.target.value })}
        {...props}
      />
    </td>
  );
  const numc = (i, k, w, props = {}) =>
    input(i, k, w, { type: "number", min: "0", step: "any", ...props });

  return (
    <Modal show onHide={onHide} fullscreen>
      <Form onSubmit={save}>
        <Modal.Header closeButton>
          <Modal.Title>Service Sale</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {err && (
            <Alert variant="danger" className="py-2">
              {err}
            </Alert>
          )}
          <SaleHeader f={f} setF={setF} clients={clients} />
          <div className="table-responsive">
            <Table size="sm" className="align-middle">
              <thead>
                <tr>
                  <th>SL</th>
                  <th>Brand</th>
                  <th>Size</th>
                  <th>Thick/MM</th>
                  <th>Service Name</th>
                  <th>Color</th>
                  <th>Grade</th>
                  <th>LTH (mm)</th>
                  <th>WTH (mm)</th>
                  <th>PCS</th>
                  <th className="text-end">QTY</th>
                  <th>Rate</th>
                  <th className="text-end">Amount</th>
                  <th>Disc</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const c = calcs[i],
                    many = it.sizes.length > 1;
                  const z0 = it.sizes[0],
                    c0 = c.sizes[0];
                  const zin = (j, k, w, req) => (
                    <td>
                      <Form.Control
                        size="sm"
                        type="number"
                        min="0"
                        step="any"
                        required={req}
                        style={{ minWidth: w }}
                        value={it.sizes[j][k]}
                        onChange={(e) => setSize(i, j, { [k]: e.target.value })}
                      />
                    </td>
                  );
                  const ftNote = (cz) =>
                    (cz.lthFt !== null || cz.wthFt !== null) && (
                      <div className="small text-muted text-nowrap">
                        {fmtFt(cz.lthFt) || "1"} × {fmtFt(cz.wthFt) || "1"} ft
                      </div>
                    );
                  return (
                    <Fragment key={i}>
                      <tr>
                        <td>{i + 1}</td>
                        {pickOpt(i, "brand", 120, "Brand")}
                        {pickOpt(i, "size", 110, "Size")}
                        {input(i, "thickness", 70)}
                        {pickOpt(i, "service", 180, "Choose service…", true)}
                        {pickOpt(i, "color", 110, "Color")}
                        <td>
                          <Form.Select
                            size="sm"
                            style={{ minWidth: 80 }}
                            value={it.grade}
                            onChange={(e) =>
                              setItem(i, { grade: e.target.value })
                            }
                          >
                            <option value="">–</option>
                            {GRADES.map((g) => (
                              <option key={g}>{g}</option>
                            ))}
                          </Form.Select>
                        </td>
                        {zin(0, "lthMm", 90)}
                        {zin(0, "wthMm", 90)}
                        {zin(0, "pcs", 60, true)}
                        <td className="text-end">
                          {c0.qty > 0 ? c0.qty : ""}
                          {ftNote(c0)}
                        </td>
                        {numc(i, "price", 80)}
                        <td className="text-end">{money(c.amount)}</td>
                        <td>
                          <div
                            className="d-flex gap-1"
                            style={{ minWidth: 130 }}
                          >
                            <Form.Control
                              size="sm"
                              type="number"
                              min="0"
                              step="any"
                              value={it.discountValue}
                              onChange={(e) =>
                                setItem(i, { discountValue: e.target.value })
                              }
                            />
                            <Form.Select
                              size="sm"
                              style={{ width: 64 }}
                              value={it.discountType}
                              onChange={(e) =>
                                setItem(i, { discountType: e.target.value })
                              }
                            >
                              <option>৳</option>
                              <option>%</option>
                            </Form.Select>
                          </div>
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="outline-danger"
                            disabled={items.length < 2}
                            onClick={() =>
                              setItems(items.filter((_, k) => k !== i))
                            }
                          >
                            ×
                          </Button>
                        </td>
                      </tr>
                      {it.sizes.slice(1).map((z, n) => {
                        const j = n + 1;
                        return (
                          <tr key={j} className="table-light">
                            <td
                              colSpan={7}
                              className="text-end small text-muted"
                            >
                              Size {j + 1}
                            </td>
                            {zin(j, "lthMm", 90)}
                            {zin(j, "wthMm", 90)}
                            {zin(j, "pcs", 60, true)}
                            <td className="text-end">
                              {c.sizes[j].qty > 0 ? c.sizes[j].qty : ""}
                              {ftNote(c.sizes[j])}
                            </td>
                            <td colSpan={3} />
                            <td>
                              <Button
                                size="sm"
                                variant="outline-danger"
                                title="Remove this size"
                                onClick={() =>
                                  setItem(i, {
                                    sizes: it.sizes.filter((_, k) => k !== j),
                                  })
                                }
                              >
                                ×
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                      <tr>
                        <td colSpan={7} className="text-end border-0 pt-0">
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            onClick={() =>
                              setItem(i, { sizes: [...it.sizes, blankSize()] })
                            }
                          >
                            + LTH × WTH
                          </Button>
                        </td>
                        <td
                          colSpan={3}
                          className="text-end border-0 small text-muted"
                        >
                          {many ? "Total QTY" : ""}
                        </td>
                        <td className="text-end border-0 fw-bold">
                          {many && c.qty > 0 ? c.qty : ""}
                        </td>
                        <td colSpan={4} className="border-0" />
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </Table>
          </div>

          <div className="d-flex align-items-center gap-4">
            <div className="flex-shrink-0">
              <Button
                size="sm"
                variant="outline-primary"
                onClick={() => setItems([...items, blankServiceRow()])}
              >
                Add another service
              </Button>
            </div>
            <div className="small text-muted mb-2">
              Type LTH and WTH in MM. The customer invoice shows them in feet
              (304.8 MM = 1 FT, rounded up to the next 0.5 ft). QTY = LTH × WTH
              × PCS in feet. <br /> If one service has windows of different sizes,
              press "+ LTH × WTH" under it to add each size on its own line.
            </div>
          </div>
          <SaleFooter f={f} setF={setF} total={total} />

          <hr className="mainHR"/>
          <div className="d-flex flex-wrap justify-content-between align-items-baseline mb-2">
            <h6 className="mb-0">Product Listing</h6>
            <span className="small text-muted">
              Internal only. Stock goes down by these quantities. The customer
              does not see this list.
            </span>
          </div>
          <div className="table-responsive">
            <Table size="sm" className="align-middle">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Brand</th>
                  <th>Size</th>
                  <th>Thick</th>
                  <th>Grade</th>
                  <th>Color</th>
                  <th>LTH</th>
                  <th>WTH</th>
                  <th>PCS in stock</th>
                  <th className="text-end">QTY in stock</th>
                  <th style={{ width: 100 }}>PCS (use)</th>
                  <th style={{ width: 130 }}>QTY</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lst.map((m, i) => {
                  const p = stockProducts.find((x) => x._id === m.product);
                  const over = p && +m.qty > p.stock;
                  return (
                    <tr key={i}>
                      <td style={{ maxWidth:50, width:"20%" }}>
                        <Form.Select
                          size="sm"
                          value={m.product}
                          onChange={(e) =>
                            setList(i, { product: e.target.value })
                          }
                        >
                          <option value="">Choose product…</option>
                          {stockProducts.map((x) => (
                            <option key={x._id} value={x._id}>
                              {x.label || x.name} ({x.stock} {x.unit} {toBold(`${x.pcs} pcs`)} )
                            </option>
                          ))}
                        </Form.Select>
                      </td>
                      <td>{p?.brand}</td>
                      <td>{p?.size}</td>
                      <td>{p?.thickness}</td>
                      <td>{p?.grade}</td>
                      <td>{p?.color}</td>
                      <td>{p?.lth}</td>
                      <td>{p?.wth}</td>
                      <td>{p ? p.pcs || 0 : ""}</td>
                      <td className="text-end">
                        {p ? `${p.stock} ${p.unit}` : ""}
                      </td>
                      <td>
                        <Form.Control
                          size="sm"
                          type="number"
                          min="0"
                          step="any"
                          value={m.pcs}
                          onChange={(e) => setList(i, { pcs: e.target.value })}
                        />
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-1">
                          <Form.Control
                            size="sm"
                            type="number"
                            min="0"
                            step="any"
                            isInvalid={!!over}
                            value={m.qty}
                            onChange={(e) =>
                              setList(i, { qty: e.target.value })
                            }
                          />
                          <span className="small text-muted">{p?.unit}</span>
                        </div>
                        {over && (
                          <div className="small text-danger">
                            More than stock
                          </div>
                        )}
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant="outline-danger"
                          disabled={lst.length < 2}
                          onClick={() => setLst(lst.filter((_, k) => k !== i))}
                        >
                          ×
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
          <Button
            size="sm"
            variant="outline-primary"
            onClick={() => setLst([...lst, blankListingRow()])}
          >
            Add product
          </Button>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={onHide}>
            Cancel
          </Button>
          <Button type="submit">Save and preview invoice</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

// ---------- Sales return / exchange ----------
const blankExchangeRow = () => ({
  product: "",
  qty: "",
  pcs: "",
  price: "",
  discount: "",
});

function ReturnModal({ sale, products, onHide, onSaved }) {
  const [info, setInfo] = useState(null),
    [q, setQ] = useState({}), // line index -> { qty, pcs, restock }
    [date, setDate] = useState(today()),
    [method, setMethod] = useState("Cash"),
    [note, setNote] = useState(""),
    [exOn, setExOn] = useState(false),
    [ex, setEx] = useState([blankExchangeRow()]),
    [paid, setPaid] = useState(""),
    [exMethod, setExMethod] = useState("Cash"),
    [err, setErr] = useState("");
  useEffect(() => {
    api(`/sales/${sale._id}/returnable`)
      .then(setInfo)
      .catch((e) => setErr(e.message));
  }, [sale._id]);
  if (!info)
    return (
      <Modal show onHide={onHide} centered>
        <Modal.Body>{err || "Loading…"}</Modal.Body>
      </Modal>
    );

  const set = (i, patch) =>
    setQ({ ...q, [i]: { restock: true, ...q[i], ...patch } });
  const value = (l) => {
    const qty = +q[l.index]?.qty || 0;
    if (qty <= 0) return 0;
    // the last part of a line gets whatever value is left, the same rule the server uses
    return Math.abs(qty - l.remaining) < 1e-9
      ? l.total - l.returnedAmount
      : (qty * l.total) / l.sold;
  };
  const R = Math.round(info.lines.reduce((t, l) => t + value(l), 0) * 100) / 100;
  const fromDue = Math.min(R, Math.max(0, info.due)),
    excess = Math.round((R - fromDue) * 100) / 100;
  const setE = (i, patch) =>
    setEx(ex.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const exLine = (r) =>
    Math.max(0, (+r.qty || 0) * (+r.price || 0) - (+r.discount || 0));
  const N = exOn ? ex.reduce((t, r) => t + exLine(r), 0) : 0;
  const credit = Math.min(excess, N),
    refund = Math.round((excess - credit) * 100) / 100,
    clientOwes = Math.round((N - credit) * 100) / 100;

  const save = async (e) => {
    e.preventDefault();
    try {
      const items = info.lines
        .filter((l) => +q[l.index]?.qty > 0)
        .map((l) => ({
          index: l.index,
          qty: q[l.index].qty,
          pcs: q[l.index].pcs || 0,
          restock: q[l.index].restock !== false,
        }));
      onSaved(
        await api(`/sales/${sale._id}/returns`, "POST", {
          date,
          items,
          note,
          refundMethod: method,
          exchange: exOn
            ? {
                items: ex.filter((r) => r.product),
                paid,
                method: exMethod,
              }
            : undefined,
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
          <Modal.Title>Return from {sale.invoiceNo}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {err && (
            <Alert variant="danger" className="py-2">
              {err}
            </Alert>
          )}
          <Row className="g-2 mb-3">
            <Col md={3}>
              <Form.Label className="mb-0 small">Return date</Form.Label>
              <Form.Control
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Col>
            <Col md={9}>
              <Form.Label className="mb-0 small">Reason / note</Form.Label>
              <Form.Control
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional"
              />
            </Col>
          </Row>
          <div className="table-responsive">
            <Table size="sm" className="align-middle">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-end">Sold</th>
                  <th className="text-end">Already returned</th>
                  <th className="text-end">Can return</th>
                  <th style={{ width: 120 }}>Return QTY</th>
                  <th style={{ width: 90 }}>PCS</th>
                  <th className="text-end">Value</th>
                  <th>Back to stock</th>
                </tr>
              </thead>
              <tbody>
                {info.lines.map((l) => (
                  <tr key={l.index}>
                    <td>
                      {l.name}
                      <div className="small text-muted">
                        {[l.brand, l.size, l.thickness, l.color, l.grade]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </td>
                    <td className="text-end">
                      {l.sold} {l.unit}
                    </td>
                    <td className="text-end">{l.returned}</td>
                    <td className="text-end">{l.remaining}</td>
                    <td>
                      <Form.Control
                        size="sm"
                        type="number"
                        min="0"
                        step="any"
                        max={l.remaining}
                        disabled={l.remaining <= 0}
                        value={q[l.index]?.qty ?? ""}
                        onChange={(e) => set(l.index, { qty: e.target.value })}
                      />
                    </td>
                    <td>
                      <Form.Control
                        size="sm"
                        type="number"
                        min="0"
                        step="any"
                        disabled={l.remaining <= 0 || l.isService}
                        value={q[l.index]?.pcs ?? ""}
                        onChange={(e) => set(l.index, { pcs: e.target.value })}
                      />
                    </td>
                    <td className="text-end">{money(value(l))}</td>
                    <td>
                      {l.isService ? (
                        <span className="small text-muted">service</span>
                      ) : (
                        <Form.Check
                          checked={q[l.index]?.restock !== false}
                          onChange={(e) =>
                            set(l.index, { restock: e.target.checked })
                          }
                          label="Yes"
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <div className="small text-muted mb-3">
            Value is the invoice price after its discount. Untick "Back to
            stock" for damaged goods: the stock is not increased and the loss
            stays in the cost of goods sold.
          </div>

          <Form.Check
            className="mb-2"
            id="ex-on"
            checked={exOn}
            onChange={(e) => setExOn(e.target.checked)}
            label="Give other products in exchange (new invoice)"
          />
          {exOn && (
            <div className="table-responsive">
              <Table size="sm" className="align-middle">
                <thead>
                  <tr>
                    <th>New product</th>
                    <th style={{ width: 110 }}>QTY</th>
                    <th style={{ width: 90 }}>PCS</th>
                    <th style={{ width: 110 }}>Rate</th>
                    <th style={{ width: 110 }}>Disc (৳)</th>
                    <th className="text-end">Amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {ex.map((r, i) => (
                    <tr key={i}>
                      <td style={{ minWidth: 240 }}>
                        <Form.Select
                          size="sm"
                          value={r.product}
                          onChange={(e) => {
                            const p = products.find(
                              (x) => x._id === e.target.value,
                            );
                            setE(i, {
                              product: e.target.value,
                              price: p ? (p.price ?? "") : "",
                            });
                          }}
                        >
                          <option value="">Choose product…</option>
                          {products.map((p) => (
                            <option key={p._id} value={p._id}>
                              {p.label || p.name} (
                              {p.isService ? "service" : `${p.stock} ${p.unit}`})
                            </option>
                          ))}
                        </Form.Select>
                      </td>
                      {["qty", "pcs", "price", "discount"].map((k) => (
                        <td key={k}>
                          <Form.Control
                            size="sm"
                            type="number"
                            min="0"
                            step="any"
                            value={r[k]}
                            onChange={(e) => setE(i, { [k]: e.target.value })}
                          />
                        </td>
                      ))}
                      <td className="text-end">{money(exLine(r))}</td>
                      <td>
                        <Button
                          size="sm"
                          variant="outline-danger"
                          disabled={ex.length < 2}
                          onClick={() => setEx(ex.filter((_, k) => k !== i))}
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
                onClick={() => setEx([...ex, blankExchangeRow()])}
              >
                Add product
              </Button>
            </div>
          )}

          <Card className="mt-3 bg-light">
            <Card.Body className="py-2">
              <Row className="g-2">
                <Col md={6}>
                  <div>
                    Return value: <b>{money(R)}</b>
                  </div>
                  <div className="small text-muted">
                    Taken off what the client still owes on this invoice:{" "}
                    {money(fromDue)}
                  </div>
                  {exOn && (
                    <div>
                      New products: <b>{money(N)}</b>
                    </div>
                  )}
                </Col>
                <Col md={6}>
                  {excess > 0 && credit > 0 && (
                    <div>
                      Used for the exchange: <b>{money(credit)}</b>
                    </div>
                  )}
                  {refund > 0 && (
                    <div className="d-flex gap-2 align-items-center">
                      <span>
                        Cash to give back: <b>{money(refund)}</b>
                      </span>
                      <MethodSelect
                        value={method}
                        onChange={setMethod}
                        className="w-auto"
                      />
                    </div>
                  )}
                  {exOn && clientOwes > 0 && (
                    <div className="d-flex gap-2 align-items-center mt-1">
                      <span>
                        Client pays for the exchange: <b>{money(clientOwes)}</b>
                      </span>
                      <Form.Control
                        size="sm"
                        type="number"
                        min="0"
                        step="any"
                        style={{ width: 110 }}
                        placeholder="Paid now"
                        value={paid}
                        onChange={(e) => setPaid(e.target.value)}
                      />
                      <MethodSelect
                        value={exMethod}
                        onChange={setExMethod}
                        className="w-auto"
                      />
                    </div>
                  )}
                  {excess === 0 && R > 0 && (
                    <div className="text-muted">
                      No money to give back: the whole value reduces the due.
                    </div>
                  )}
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={onHide}>
            Cancel
          </Button>
          <Button type="submit" disabled={R <= 0}>
            Save return
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function ReturnMemo({ ret, sale, onHide }) {
  return (
    <PrintModal title={`Return ${ret.returnNo}`} onHide={onHide}>
      <div className="text-center fw-bold border-top border-bottom py-1 mb-2">
        Return / Credit Note
      </div>
      <Row className="small mb-2">
        <Col>
          Customer Name : <b>{sale.client.name}</b> ({sale.client.clientId})
          <br />
          Address : {sale.client.address}
          <br />
          Phone : {sale.client.phone}
        </Col>
        <Col>
          Return No : <b>{ret.returnNo}</b>
          <br />
          Date : {fdate(ret.date)}
          <br />
          Against Invoice : <b>{sale.invoiceNo}</b>
          <br />
          Note : {ret.note}
        </Col>
      </Row>
      <Table bordered size="sm" className="memo-table">
        <thead>
          <tr>
            <th>SL.</th>
            <th>BRAND</th>
            <th>SIZE</th>
            <th>THK.</th>
            <th>PRODUCT NAME</th>
            <th>COLOR</th>
            <th className="text-end">QTY</th>
            <th className="text-end">RATE</th>
            <th className="text-end">AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          {ret.items.map((l, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{l.brand}</td>
              <td>{l.size}</td>
              <td>{l.thickness}</td>
              <td>{l.name}</td>
              <td>{l.color}</td>
              <td className="text-end">
                {l.qty} {l.unit || ""}
              </td>
              <td className="text-end">{n2(l.price)}</td>
              <td className="text-end">{n2(l.total)}</td>
            </tr>
          ))}
          <tr className="fw-bold">
            <td colSpan={8} className="text-end">
              TOTAL RETURNED :
            </td>
            <td className="text-end">{n2(ret.total)}</td>
          </tr>
        </tbody>
      </Table>
      <div className="small">
        {ret.fromDue > 0 && (
          <div>Adjusted against the due of this invoice : {n2(ret.fromDue)}</div>
        )}
        {ret.credit > 0 && (
          <div>
            Used for exchange invoice {ret.exchangeSale?.invoiceNo} :{" "}
            {n2(ret.credit)}
          </div>
        )}
        {ret.refunded > 0 && (
          <div>
            Paid back in cash ({ret.refundMethod}) : {n2(ret.refunded)}
          </div>
        )}
        <div className="mt-1">In Words : {words(ret.total)}</div>
      </div>
      <Row className="mt-5 pt-3 text-center small">
        {["PREPARED BY", "RECEIVED BY", "AUTHORIZED BY"].map((t) => (
          <Col key={t}>
            <div className="border-top pt-1 mx-2">{t}</div>
          </Col>
        ))}
      </Row>
    </PrintModal>
  );
}

// The returns of one invoice: print the credit note, or undo a return made by mistake
function ReturnsList({ sale, onHide, onChanged }) {
  const [list, setList] = useState([]),
    [memo, setMemo] = useState(null),
    [err, setErr] = useState("");
  const load = () =>
    api(`/sales/${sale._id}/returns`)
      .then(setList)
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  const del = async (r) => {
    if (
      !confirm(
        `Delete ${r.returnNo}? The goods leave the stock again and ${sale.invoiceNo} goes back to how it was.` +
          (r.exchangeSale ? ` The exchange invoice ${r.exchangeSale.invoiceNo} is deleted too.` : ""),
      )
    )
      return;
    try {
      await api(`/returns/${r._id}`, "DELETE");
      await load();
      onChanged();
    } catch (x) {
      setErr(x.message);
    }
  };
  return (
    <>
      <Modal show onHide={onHide} centered>
        <Modal.Header closeButton>
          <Modal.Title>Returns of {sale.invoiceNo}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {err && (
            <Alert variant="danger" className="py-2">
              {err}
            </Alert>
          )}
          <Table size="sm" className="align-middle mb-0">
            <tbody>
              {list.map((r) => (
                <tr key={r._id}>
                  <td>
                    <b>{r.returnNo}</b>
                    <div className="small text-muted">{fdate(r.date)}</div>
                  </td>
                  <td className="text-end">
                    {money(r.total)}
                    {r.exchangeSale && (
                      <div className="small text-muted">
                        exchange {r.exchangeSale.invoiceNo}
                      </div>
                    )}
                  </td>
                  <td className="text-end text-nowrap">
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      className="me-1"
                      onClick={() => setMemo(r)}
                    >
                      Memo
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
              {!list.length && (
                <tr>
                  <td className="text-muted">No returns.</td>
                </tr>
              )}
            </tbody>
          </Table>
        </Modal.Body>
      </Modal>
      {memo && (
        <ReturnMemo ret={memo} sale={sale} onHide={() => setMemo(null)} />
      )}
    </>
  );
}

function Materials({ sale, products, onHide }) {
  const [s, setS] = useState(sale),
    [f, setF] = useState({ product: "", qty: "", pcs: "" }),
    [err, setErr] = useState("");
  const [list, setList] = useState(products);
  const refresh = () => api("/products").then(setList);
  const add = async (e) => {
    e.preventDefault();
    try {
      setS(await api(`/sales/${s._id}/materials`, "POST", f));
      setF({ product: "", qty: "", pcs: "" });
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
        <Modal.Title>
          {s.saleType === "service" ? "Product Listing" : "Materials used"}:{" "}
          {s.invoiceNo}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert variant="light" className="border py-2">
          {s.saleType === "service" ? "Invoice" : "Contract"} amount{" "}
          <b>{money(s.total)}</b> stays the same.{" "}
          {s.saleType === "service"
            ? "The Product Listing only reduces stock. The customer does not see it."
            : "Materials only reduce stock."}
        </Alert>
        {err && (
          <Alert variant="danger" className="py-2">
            {err}
          </Alert>
        )}
        <Form onSubmit={add}>
          <Row className="g-2 mb-3">
            <Col md={5}>
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
                      {p.label || p.name} ({p.stock} {p.unit}, {p.pcs || 0} pcs
                      in stock)
                    </option>
                  ))}
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Control
                type="number"
                min="0"
                step="any"
                placeholder="PCS"
                value={f.pcs}
                onChange={(e) => setF({ ...f, pcs: e.target.value })}
              />
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
              <th className="text-end">PCS</th>
              <th className="text-end">Qty</th>
              <th className="text-end">Sell value</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {mats.map((m) => (
              <tr key={m._id}>
                <td>{m.name}</td>
                <td className="text-end">{m.pcs ?? ""}</td>
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
                <td colSpan="5" className="text-center text-muted py-3">
                  No materials added yet.
                </td>
              </tr>
            )}
          </tbody>
          {!!mats.length && (
            <tfoot>
              <tr className="fw-bold">
                <td colSpan="3">
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

// Moukuf: the client will not pay the rest, so the shop gives it up. Needs an explicit confirmation.
function WaiveModal({ sale, onHide, onDone }) {
  const [amount, setAmount] = useState(sale.due),
    [date, setDate] = useState(today()),
    [note, setNote] = useState(""),
    [ok, setOk] = useState(false),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState("");
  const a = Math.round((Number(amount) || 0) * 100) / 100;
  const bad = !(a > 0) || a > sale.due + 1e-9;
  const go = async (e) => {
    e.preventDefault();
    if (bad || !ok) return;
    setBusy(true);
    try {
      await api(`/sales/${sale._id}/waive`, "POST", {
        amount: a,
        date,
        note,
        confirm: true,
      });
      onDone();
    } catch (x) {
      setErr(x.message);
      setBusy(false);
    }
  };
  return (
    <Modal show onHide={onHide} centered>
      <Form onSubmit={go}>
        <Modal.Header closeButton>
          <Modal.Title>Moukuf (waive due) · {sale.invoiceNo}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">
            Client: <b>{sale.client?.name}</b> ({sale.client?.clientId})
            <br />
            Invoice total: <b>{money(sale.total)}</b> · Paid:{" "}
            <b>{money(sale.paid)}</b>
            <br />
            Due now: <b>{money(sale.due)}</b>
          </p>
          {err && (
            <Alert variant="danger" className="py-2">
              {err}
            </Alert>
          )}
          <Form.Group className="mb-2">
            <Form.Label>Amount to waive (৳)</Form.Label>
            <Form.Control
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              isInvalid={bad}
            />
            <Form.Control.Feedback type="invalid">
              Enter an amount between 0 and {money(sale.due)}
            </Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>Date</Form.Label>
            <Form.Control
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Reason (optional)</Form.Label>
            <Form.Control
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. client will not pay the rest"
            />
          </Form.Group>
          <Alert variant="warning" className="py-2 small">
            The client will no longer owe <b>{money(bad ? 0 : a)}</b>. It is
            removed from Dues and shown in the Income Statement as "Dues waived
            (Moukuf)", so your profit goes down by this amount. No money is
            received. You can undo it later from the invoice.
          </Alert>
          <Form.Check
            type="checkbox"
            id="waive-ok"
            label="I confirm, waive this amount"
            checked={ok}
            onChange={(e) => setOk(e.target.checked)}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={onHide}>
            Cancel
          </Button>
          <Button type="submit" variant="dark" disabled={bad || !ok || busy}>
            Confirm Moukuf
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export function Sales() {
  const [rows, setRows] = useState([]),
    [clients, setClients] = useState([]),
    [products, setProducts] = useState([]);
  const [fl, setFl] = useState({ q: "", from: "", to: "", status: "" });
  const [adding, setAdding] = useState(
      window.location.search.includes("new=service")
        ? "service"
        : window.location.search.includes("new=1")
          ? "product"
          : null,
    ),
    [memo, setMemo] = useState(null),
    [mistry, setMistry] = useState(null),
    [pay, setPay] = useState(null),
    [stmt, setStmt] = useState(null),
    [err, setErr] = useState("");
  const [mat, setMat] = useState(null),
    [ret, setRet] = useState(null),
    [rets, setRets] = useState(null),
    [waive, setWaive] = useState(null),
    [retMemo, setRetMemo] = useState(null);
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
        <Col xs="auto" className="d-flex gap-2">
          <Button onClick={() => setAdding("product")}>Product Sale</Button>
          <Button
            variant="outline-primary"
            onClick={() => setAdding("service")}
          >
            Service Sale
          </Button>
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
                    {s.saleType === "service" && (
                      <div>
                        <Badge bg="info">Service</Badge>
                      </div>
                    )}
                    {s.returned > 0 && (
                      <div>
                        <Badge bg="warning" text="dark">
                          Returned {money(s.returned)}
                        </Badge>
                      </div>
                    )}
                    {s.waived > 0 && (
                      <div>
                        <Badge bg="dark">WAIVED {money(s.waived)}</Badge>
                      </div>
                    )}
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
                    {s.saleType === "service" && (
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        className="me-1"
                        onClick={() => setMistry(s)}
                      >
                        Mistry memo
                      </Button>
                    )}
                    {(s.saleType === "service" ||
                      s.items.some((l) => l.isContract)) && (
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        className="me-1"
                        onClick={() => setMat(s)}
                      >
                        {s.saleType === "service"
                          ? "Product Listing"
                          : "Materials"}
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
                    {s.due > 0 && (
                      <Button
                        size="sm"
                        variant="outline-dark"
                        className="me-1"
                        onClick={() => setWaive(s)}
                      >
                        WAIVED
                      </Button>
                    )}
                    {s.waived > 0 && (
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        className="me-1"
                        onClick={async () => {
                          if (
                            !window.confirm(
                              `Undo the Moukuf of ${money(s.waived)} on ${s.invoiceNo}? That amount will become due again.`
                            )
                          )
                            return;
                          try {
                            await api(`/sales/${s._id}/waive`, "DELETE");
                            load();
                          } catch (x) {
                            setErr(x.message);
                          }
                        }}
                      >
                        Undo WAIVED
                      </Button>
                    )}
                    {s.saleType !== 'service' && (
                      <Button
                        size="sm"
                        variant="outline-warning"
                        className="me-1"
                        onClick={() => setRet(s)}
                      >
                        Return
                      </Button>
                    )}
                    {s.returned > 0 && (
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        className="me-1"
                        onClick={() => setRets(s)}
                      >
                        Returns
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
                    No sales found. Click "Product Sale" or "Service Sale" to
                    add one.
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
      {adding === "product" && (
        <NewSale
          clients={clients}
          products={products}
          onHide={() => setAdding(null)}
          onSaved={(s) => {
            setAdding(null);
            setMemo(s);
            load();
            loadLists();
          }}
        />
      )}
      {adding === "service" && (
        <NewServiceSale
          clients={clients}
          products={products}
          onHide={() => setAdding(null)}
          onSaved={(s) => {
            setAdding(null);
            setMemo(s);
            load();
            loadLists();
          }}
        />
      )}
      {memo && (
        <Memo
          s={memo}
          onHide={() => setMemo(null)}
          onMistry={() => {
            setMistry(memo);
            setMemo(null);
          }}
        />
      )}
      {mistry && <MistryMemo s={mistry} onHide={() => setMistry(null)} />}
      {ret && (
        <ReturnModal
          sale={ret}
          products={products}
          onHide={() => setRet(null)}
          onSaved={(r) => {
            const sale = ret;
            setRet(null);
            setRetMemo({ ret: r, sale });
            load();
            loadLists();
          }}
        />
      )}
      {waive && (
        <WaiveModal
          sale={waive}
          onHide={() => setWaive(null)}
          onDone={() => {
            setWaive(null);
            load();
          }}
        />
      )}
      {rets && (
        <ReturnsList
          sale={rets}
          onHide={() => setRets(null)}
          onChanged={() => {
            load();
            loadLists();
          }}
        />
      )}
      {retMemo && (
        <ReturnMemo
          ret={retMemo.ret}
          sale={retMemo.sale}
          onHide={() => setRetMemo(null)}
        />
      )}
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
                  <td className="text-end fw-bold">
                    {money(r.due)}
                    {r.opening > 0 && (
                      <div className="small text-muted fw-normal">
                        incl. opening {money(r.opening)}
                      </div>
                    )}
                  </td>
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
