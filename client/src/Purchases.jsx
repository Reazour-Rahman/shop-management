import { useEffect, useState } from 'react';
import { Button, Form, Modal, Alert, Card, Table, Badge, Row, Col } from 'react-bootstrap';
import { api } from './api';
import { PayModal, MethodSelect, money, fdate, today, COLOR } from './Sales.jsx';

const age = d => Math.floor((Date.now() - new Date(d)) / 864e5);
const blank = { product: '', qty: '', pcs: '', cost: '' };

function NewPurchase({ suppliers, products, onHide, onSaved }) {
  const [f, setF] = useState({ mode: 'old', supplier: '', ns: { name: '', phone: '' }, date: today(), paid: '', method: 'Cash', note: '' });
  const [items, setItems] = useState([{ ...blank }]);
  const [made, setMade] = useState(null), [err, setErr] = useState('');
  const setItem = (i, patch) => setItems(items.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  const total = items.reduce((s, it) => s + (+it.qty || 0) * (+it.cost || 0), 0);
  const save = async e => {
    e.preventDefault();
    try {
      let supplier = f.mode === 'new' ? made : f.supplier;
      if (f.mode === 'new' && !supplier) { supplier = (await api('/suppliers', 'POST', f.ns))._id; setMade(supplier); }
      onSaved(await api('/purchases', 'POST', { supplier, date: f.date, items, paid: f.paid, method: f.method, note: f.note }));
    } catch (x) { setErr(x.message); }
  };
  return (
    <Modal show onHide={onHide} size="xl" centered><Form onSubmit={save}>
      <Modal.Header closeButton><Modal.Title>New purchase</Modal.Title></Modal.Header>
      <Modal.Body>
        {err && <Alert variant="danger" className="py-2">{err}</Alert>}
        <Row className="g-2 mb-3">
          <Col md={3}><Form.Select value={f.mode} onChange={e => setF({ ...f, mode: e.target.value })}>
            <option value="old">Existing supplier</option><option value="new">New supplier</option></Form.Select></Col>
          {f.mode === 'old' ? (
            <Col md={6}><Form.Select required value={f.supplier} onChange={e => setF({ ...f, supplier: e.target.value })}>
              <option value="">Choose supplier…</option>{suppliers.map(s => <option key={s._id} value={s._id}>{s.name} {s.phone}</option>)}</Form.Select></Col>
          ) : (<>
            <Col md={3}><Form.Control required placeholder="Company / supplier name" value={f.ns.name} onChange={e => setF({ ...f, ns: { ...f.ns, name: e.target.value } })} /></Col>
            <Col md={3}><Form.Control placeholder="Phone" value={f.ns.phone} onChange={e => setF({ ...f, ns: { ...f.ns, phone: e.target.value } })} /></Col>
          </>)}
          <Col md={3}><Form.Control type="date" required value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Col>
        </Row>
        <Table size="sm" className="align-middle">
          <thead><tr><th style={{ width: '38%' }}>Product</th><th>Quantity</th><th>PCS</th><th>Unit cost (৳)</th><th className="text-end">Total</th><th /></tr></thead>
          <tbody>{items.map((it, i) => (
            <tr key={i}>
              <td><Form.Select required value={it.product} onChange={e => setItem(i, { product: e.target.value })}>
                <option value="">Choose product…</option>
                {products.filter(p => !p.isService).map(p => <option key={p._id} value={p._id}>{p.label || p.name} ({p.stock} {p.unit}, {p.pcs || 0} pcs now)</option>)}</Form.Select></td>
              <td><Form.Control type="number" min="0" step="any" value={it.qty} onChange={e => setItem(i, { qty: e.target.value })} /></td>
              <td><Form.Control type="number" min="0" step="any" value={it.pcs} onChange={e => setItem(i, { pcs: e.target.value })} /></td>
              <td><Form.Control type="number" min="0" step="any" value={it.cost} onChange={e => setItem(i, { cost: e.target.value })} /></td>
              <td className="text-end">{money((+it.qty || 0) * (+it.cost || 0))}</td>
              <td><Button size="sm" variant="outline-danger" disabled={items.length < 2} onClick={() => setItems(items.filter((_, k) => k !== i))}>×</Button></td>
            </tr>))}</tbody>
        </Table>
        <Button size="sm" variant="outline-primary" onClick={() => setItems([...items, { ...blank }])}>Add another product</Button>
        <Row className="g-2 mt-3 align-items-end">
          <Col md={5}><Form.Control placeholder="Note (optional)" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} /></Col>
          <Col md={3}><Form.Label className="mb-0">Paid now (৳)</Form.Label>
            <Form.Control type="number" min="0" step="any" value={f.paid} onChange={e => setF({ ...f, paid: e.target.value })} />
            <MethodSelect className="mt-1" value={f.method} onChange={v => setF({ ...f, method: v })} /></Col>
          <Col md={4} className="text-end">Total <b>{money(total)}</b><br />Payable <b className="text-danger">{money(total - (+f.paid || 0))}</b></Col>
        </Row>
      </Modal.Body>
      <Modal.Footer><Button variant="light" onClick={onHide}>Cancel</Button><Button type="submit">Save purchase</Button></Modal.Footer>
    </Form></Modal>
  );
}

export function Purchases() {
  const [rows, setRows] = useState([]), [sups, setSups] = useState([]), [prods, setProds] = useState([]);
  const [fl, setFl] = useState({ q: '', from: '', to: '', status: '' });
  const [adding, setAdding] = useState(window.location.search.includes('new=1')), [pay, setPay] = useState(null), [err, setErr] = useState('');
  const load = () => api('/purchases?' + new URLSearchParams(fl)).then(setRows).catch(e => setErr(e.message));
  const loadLists = () => Promise.all([api('/suppliers'), api('/products')]).then(([s, p]) => { setSups(s); setProds(p); });
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [fl]);
  useEffect(() => { loadLists(); }, []);
  const del = async p => {
    if (!confirm(`Delete ${p.purchaseNo}? Stock and payments of this purchase will be reversed.`)) return;
    try { await api(`/purchases/${p._id}`, 'DELETE'); load(); loadLists(); } catch (x) { setErr(x.message); }
  };
  const sum = k => rows.reduce((s, x) => s + x[k], 0);
  return (
    <>
      <Row className="mb-3 g-2 align-items-center"><Col><h4 className="mb-0">Purchases</h4></Col>
        <Col xs="auto"><Button onClick={() => setAdding(true)}>New purchase</Button></Col></Row>
      <Row className="g-2 mb-3">
        <Col md={4}><Form.Control placeholder="Search purchase no, supplier, phone" value={fl.q} onChange={e => setFl({ ...fl, q: e.target.value })} /></Col>
        <Col md={2}><Form.Control type="date" value={fl.from} onChange={e => setFl({ ...fl, from: e.target.value })} /></Col>
        <Col md={2}><Form.Control type="date" value={fl.to} onChange={e => setFl({ ...fl, to: e.target.value })} /></Col>
        <Col md={2}><Form.Select value={fl.status} onChange={e => setFl({ ...fl, status: e.target.value })}>
          <option value="">All status</option><option>Paid</option><option>Partial</option><option>Due</option></Form.Select></Col>
      </Row>
      {err && <Alert variant="danger" dismissible onClose={() => setErr('')}>{err}</Alert>}
      <Card className="shadow-sm"><div className="table-responsive">
        <Table hover className="mb-0">
          <thead><tr><th>Purchase</th><th>Date</th><th>Supplier</th><th>Items</th><th className="text-end">Total</th><th className="text-end">Paid</th><th className="text-end">Payable</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map(p => (
              <tr key={p._id}>
                <td><b>{p.purchaseNo}</b></td><td>{fdate(p.date)}</td><td>{p.supplier?.name}</td>
                <td className="small">{p.items.map(l => `${l.name} ${l.qty} ${l.unit}${l.pcs ? `, ${l.pcs} pcs` : ''}`).join(', ')}</td>
                <td className="text-end">{money(p.total)}</td><td className="text-end">{money(p.paid)}</td><td className="text-end">{money(p.due)}</td>
                <td><Badge bg={COLOR[p.status]}>{p.status}</Badge></td>
                <td className="text-end text-nowrap">
                  {p.due > 0 && <Button size="sm" className="me-1" onClick={() => setPay({ title: `Payment for ${p.purchaseNo}`, max: p.due, url: `/purchases/${p._id}/payments` })}>Pay</Button>}
                  <Button size="sm" variant="outline-danger" onClick={() => del(p)}>Delete</Button>
                </td>
              </tr>))}
            {!rows.length && <tr><td colSpan="9" className="text-center text-muted py-4">No purchases found. Click "New purchase" to add one.</td></tr>}
          </tbody>
          {!!rows.length && <tfoot><tr className="fw-bold"><td colSpan="4">Total sourcing ({rows.length} purchases)</td>
            <td className="text-end">{money(sum('total'))}</td><td className="text-end">{money(sum('paid'))}</td><td className="text-end">{money(sum('due'))}</td><td colSpan="2" /></tr></tfoot>}
        </Table>
      </div></Card>
      {adding && <NewPurchase suppliers={sups} products={prods} onHide={() => setAdding(false)} onSaved={() => { setAdding(false); load(); loadLists(); }} />}
      {pay && <PayModal target={pay} onHide={() => setPay(null)} onDone={() => { setPay(null); load(); }} />}
    </>
  );
}

export function Suppliers() {
  const [rows, setRows] = useState([]), [edit, setEdit] = useState(null), [pay, setPay] = useState(null), [err, setErr] = useState('');
  const load = () => api('/supplier-summary').then(setRows).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);
  const save = async e => {
    e.preventDefault();
    try { await (edit._id ? api(`/suppliers/${edit._id}`, 'PUT', edit) : api('/suppliers', 'POST', edit)); setEdit(null); setErr(''); load(); }
    catch (x) { setErr(x.message); }
  };
  const del = async s => {
    if (!confirm(`Delete ${s.name}?`)) return;
    try { await api(`/suppliers/${s._id}`, 'DELETE'); load(); } catch (x) { setErr(x.message); }
  };
  const sum = k => rows.reduce((s, x) => s + x[k], 0);
  return (
    <>
      <Row className="mb-3 g-2 align-items-center"><Col><h4 className="mb-0">Suppliers and payables</h4></Col>
        <Col xs="auto"><Button onClick={() => { setErr(''); setEdit({}); }}>Add supplier</Button></Col></Row>
      <Alert variant="light" className="border">Total purchased <b>{money(sum('total'))}</b> · Paid <b>{money(sum('paid'))}</b> · Payable <b className="text-danger">{money(sum('due'))}</b></Alert>
      {err && !edit && <Alert variant="danger" dismissible onClose={() => setErr('')}>{err}</Alert>}
      <Card className="shadow-sm"><div className="table-responsive">
        <Table hover className="mb-0">
          <thead><tr><th>Supplier</th><th>Purchases</th><th className="text-end">Total purchase</th><th className="text-end">Paid</th><th className="text-end">Payable</th><th>Oldest payable</th><th /></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.supplier._id}>
                <td><b>{r.supplier.name}</b><div className="small text-muted">{r.supplier.phone} {r.supplier.address}</div></td>
                <td>{r.count}</td><td className="text-end">{money(r.total)}</td><td className="text-end">{money(r.paid)}</td>
                <td className="text-end fw-bold">{money(r.due)}{r.opening > 0 && <div className="small text-muted fw-normal">incl. opening {money(r.opening)}</div>}</td>
                <td>{r.oldest ? <>{age(r.oldest)} days {age(r.oldest) > 30 && <Badge bg="danger">Old</Badge>}</> : '–'}</td>
                <td className="text-end text-nowrap">
                  {r.due > 0 && <Button size="sm" className="me-1" onClick={() => setPay({ title: `Payment to ${r.supplier.name}`, max: r.due, url: `/suppliers/${r.supplier._id}/pay` })}>Pay supplier</Button>}
                  <Button size="sm" variant="outline-secondary" className="me-1" onClick={() => { setErr(''); setEdit(r.supplier); }}>Edit</Button>
                  <Button size="sm" variant="outline-danger" onClick={() => del(r.supplier)}>Delete</Button>
                </td>
              </tr>))}
            {!rows.length && <tr><td colSpan="7" className="text-center text-muted py-4">No suppliers yet. Add one, or create one while adding a purchase.</td></tr>}
          </tbody>
        </Table>
      </div></Card>
      <Modal show={!!edit} onHide={() => setEdit(null)} centered><Form onSubmit={save}>
        <Modal.Header closeButton><Modal.Title>{edit?._id ? 'Edit supplier' : 'Add supplier'}</Modal.Title></Modal.Header>
        <Modal.Body>
          {err && <Alert variant="danger" className="py-2">{err}</Alert>}
          {edit && [['name', 'Company / supplier name', true], ['phone', 'Phone'], ['address', 'Address']].map(([k, l, req]) => (
            <Form.Group key={k} className="mb-3"><Form.Label>{l}</Form.Label>
              <Form.Control required={req} value={edit[k] ?? ''} onChange={e => setEdit({ ...edit, [k]: e.target.value })} /></Form.Group>))}
          {edit && <>
            <Form.Group className="mb-3"><Form.Label>Opening payable (৳): what you already owed this supplier before you started using this system</Form.Label>
              <Form.Control type="number" min="0" step="any" value={edit.openingPayable ?? ''} onChange={e => setEdit({ ...edit, openingPayable: e.target.value })} />
              <Form.Text className="text-muted">Leave empty if nothing is owed. It is not counted as a purchase in the income statement.</Form.Text></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Opening payable as of date</Form.Label>
              <Form.Control type="date" value={String(edit.openingDate ?? '').slice(0, 10)} onChange={e => setEdit({ ...edit, openingDate: e.target.value })} />
              <Form.Text className="text-muted">Empty means today.</Form.Text></Form.Group></>}
        </Modal.Body>
        <Modal.Footer><Button variant="light" onClick={() => setEdit(null)}>Cancel</Button><Button type="submit">Save supplier</Button></Modal.Footer>
      </Form></Modal>
      {pay && <PayModal target={pay} onHide={() => setPay(null)} onDone={() => { setPay(null); load(); }} />}
    </>
  );
}

/* const TYPE = { sale: 'Sale', purchase: 'Purchase', opening: 'Opening stock' }; */
const TYPE = { sale: 'Sale', purchase: 'Purchase', opening: 'Opening stock', contract: 'Contract use' };

export function Stock() {
  const [rows, setRows] = useState([]), [hist, setHist] = useState(null), [moves, setMoves] = useState([]);
  useEffect(() => { api('/products').then(p => setRows(p.filter(x => !x.isService))); }, []);
  const open = p => { setHist(p); setMoves([]); api(`/stock-moves?product=${p._id}`).then(setMoves); };
  const low = rows.filter(p => p.stock <= p.lowStock);
  return (
    <>
      <h4 className="mb-3">Stock</h4>
      {!!low.length && <Alert variant="danger"><b>Low stock:</b> {low.map(p => `${p.label || p.name} (${p.stock} ${p.unit})`).join(', ')}</Alert>}
      <Card className="shadow-sm"><div className="table-responsive">
        <Table hover className="mb-0">
          <thead><tr><th>Product</th><th className="text-end">Stock now</th><th>Unit</th><th>Alert level</th><th /></tr></thead>
          <tbody>
            {rows.map(p => (
              <tr key={p._id}><td><b>{p.label || p.name}</b></td>
                <td className="text-end">{p.stock} {p.stock <= p.lowStock && <Badge bg="danger">Low</Badge>}</td>
                <td>{p.unit}</td><td>{p.lowStock}</td>
                <td className="text-end"><Button size="sm" variant="outline-secondary" onClick={() => open(p)}>Movement history</Button></td></tr>))}
            {!rows.length && <tr><td colSpan="5" className="text-center text-muted py-4">No products yet. Add products first.</td></tr>}
          </tbody>
        </Table>
      </div></Card>
      <Modal show={!!hist} onHide={() => setHist(null)} centered size="lg">
        <Modal.Header closeButton><Modal.Title>{hist?.label || hist?.name}: stock movement</Modal.Title></Modal.Header>
        <Modal.Body>
          <Table size="sm"><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th className="text-end">Change ({hist?.unit})</th></tr></thead>
            <tbody>
              {moves.map(m => (
                <tr key={m._id}><td>{fdate(m.date)}</td><td>{TYPE[m.type] || m.type}</td><td>{m.ref}</td>
                  <td className={'text-end ' + (m.qty < 0 ? 'text-danger' : 'text-success')}>{m.qty > 0 ? '+' : ''}{m.qty}</td></tr>))}
              {!moves.length && <tr><td colSpan="4" className="text-center text-muted py-3">No movements yet.</td></tr>}
            </tbody></Table>
        </Modal.Body>
      </Modal>
    </>
  );
}
