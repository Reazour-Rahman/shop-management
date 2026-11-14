import { useEffect, useState } from 'react';
import { Button, Form, Modal, Alert, Card, Table, Badge, Row, Col } from 'react-bootstrap';
import { api } from './api';
import { PrintModal, fdate, today } from './Sales.jsx';

const FIELDS = [['brand', 'Brand'], ['grade', 'Grade'], ['thickness', 'Thick (MM)'], ['color', 'Color'], ['size', 'Size']];
const PRINT = [['brand', 'BRAND'], ['grade', 'GRADE'], ['thickness', 'THK.'], ['product', 'PRODUCT NAME'], ['color', 'COLOR'], ['size', 'SIZE']];
const blankSpec = () => ({ productId: '', product: '', brand: '', grade: '', thickness: '', color: '', size: '' });
const blankItem = () => ({ service: '', qty: '', specs: [blankSpec()] });
const STATUS = ['Draft', 'In progress', 'Done'];
const TONE = { Draft: 'secondary', 'In progress': 'warning', Done: 'success' };
const fresh = () => ({ client: '', clientName: '', phone: '', siteAddress: '', date: today(), status: 'Draft', note: '', items: [blankItem()] });

function OrderForm({ init, clients, products, onHide, onSaved }) {
  const [o, setO] = useState(init), [err, setErr] = useState('');
  const setItem = (i, patch) => setO({ ...o, items: o.items.map((it, k) => (k === i ? { ...it, ...patch } : it)) });
  const setSpec = (i, j, patch) => setItem(i, { specs: o.items[i].specs.map((s, k) => (k === j ? { ...s, ...patch } : s)) });
  const pickClient = id => {
    const c = clients.find(x => x._id === id);
    setO({ ...o, client: id, ...(c ? { clientName: c.name, phone: c.phone, siteAddress: c.address || '' } : {}) });
  };
  // Choosing a product fills its brand, thickness, color and size. Grade is typed by hand.
  const pickProduct = (i, j, id) => {
    const p = products.find(x => x._id === id);
    setSpec(i, j, id === '__custom' ? { productId: id, product: '' }
      : p ? { productId: id, product: p.name, brand: p.brand || '', thickness: p.thickness || '', color: p.color || '', size: p.size || '' }
      : { productId: '' });
  };
  const save = async e => {
    e.preventDefault();
    try { onSaved(await (o._id ? api(`/orders/${o._id}`, 'PUT', o) : api('/orders', 'POST', o))); } catch (x) { setErr(x.message); }
  };
  return (
    <Modal show onHide={onHide} size="xl" centered><Form onSubmit={save}>
      <Modal.Header closeButton><Modal.Title>{o._id ? `Edit ${o.orderNo}` : 'New order draft'}</Modal.Title></Modal.Header>
      <Modal.Body>
        {err && <Alert variant="danger" className="py-2">{err}</Alert>}
        <Row className="g-2 mb-3">
          <Col md={4}><Form.Select value={o.client || ''} onChange={e => pickClient(e.target.value)}>
            <option value="">Choose existing client (optional)…</option>
            {clients.map(c => <option key={c._id} value={c._id}>{c.clientId} · {c.name} · {c.phone}</option>)}</Form.Select></Col>
          <Col md={4}><Form.Control required placeholder="Client name" value={o.clientName || ''} onChange={e => setO({ ...o, clientName: e.target.value })} /></Col>
          <Col md={4}><Form.Control placeholder="Phone" value={o.phone || ''} onChange={e => setO({ ...o, phone: e.target.value })} /></Col>
          <Col md={6}><Form.Control placeholder="Project / site address" value={o.siteAddress || ''} onChange={e => setO({ ...o, siteAddress: e.target.value })} /></Col>
          <Col md={3}><Form.Control type="date" required value={o.date} onChange={e => setO({ ...o, date: e.target.value })} /></Col>
          <Col md={3}><Form.Select value={o.status} onChange={e => setO({ ...o, status: e.target.value })}>{STATUS.map(s => <option key={s}>{s}</option>)}</Form.Select></Col>
        </Row>
        {o.items.map((it, i) => (
          <Card key={i} className="mb-3"><Card.Body>
            <Row className="g-2 mb-2 align-items-center">
              <Col xs="auto" className="fw-bold">SL {i + 1}</Col>
              <Col md={6}><Form.Control placeholder="Service name (e.g. Sliding window, Door, Ceiling)" value={it.service} onChange={e => setItem(i, { service: e.target.value })} /></Col>
              <Col md={2}><Form.Control type="number" min="0" step="any" placeholder="Pcs / Qty" value={it.qty} onChange={e => setItem(i, { qty: e.target.value })} /></Col>
              <Col xs="auto"><Button size="sm" variant="outline-danger" disabled={o.items.length < 2} onClick={() => setO({ ...o, items: o.items.filter((_, k) => k !== i) })}>Remove service</Button></Col>
            </Row>
            <div className="table-responsive"><Table size="sm" className="mb-1 align-middle">
              <thead><tr><th>Product name</th>{FIELDS.map(([k, l]) => <th key={k}>{l}</th>)}<th /></tr></thead>
              <tbody>{it.specs.map((s, j) => (
                <tr key={j}>
                  <td style={{ minWidth: 230 }}>
                    <Form.Select size="sm" value={s.productId || ''} onChange={e => pickProduct(i, j, e.target.value)}>
                      <option value="">Choose product…</option>
                      {products.filter(p => !p.isService).map(p => <option key={p._id} value={p._id}>{p.label || p.name}</option>)}
                      <option value="__custom">Other (type name)</option>
                    </Form.Select>
                    {s.productId === '__custom' && <Form.Control size="sm" className="mt-1" placeholder="Product name" value={s.product || ''} onChange={e => setSpec(i, j, { product: e.target.value })} />}
                  </td>
                  {FIELDS.map(([k, l]) => <td key={k}><Form.Control size="sm" placeholder={l} value={s[k] || ''} onChange={e => setSpec(i, j, { [k]: e.target.value })} /></td>)}
                  <td><Button size="sm" variant="outline-danger" onClick={() => setItem(i, { specs: it.specs.filter((_, m) => m !== j) })}>×</Button></td>
                </tr>))}</tbody>
            </Table></div>
            <Button size="sm" variant="outline-primary" onClick={() => setItem(i, { specs: [...it.specs, blankSpec()] })}>Add product to this service</Button>
          </Card.Body></Card>))}
        <Button variant="outline-primary" onClick={() => setO({ ...o, items: [...o.items, blankItem()] })}>Add another service</Button>
        <Form.Control className="mt-3" placeholder="Note / instructions for the mistry (optional)" value={o.note || ''} onChange={e => setO({ ...o, note: e.target.value })} />
      </Modal.Body>
      <Modal.Footer><Button variant="light" onClick={onHide}>Cancel</Button><Button type="submit">Save order</Button></Modal.Footer>
    </Form></Modal>
  );
}

function OrderPrint({ o, onHide }) {
  return (
    <PrintModal title={`Work order ${o.orderNo}`} onHide={onHide}>
      <h5 className="text-center border-top border-bottom py-1">Work Order / Job Card</h5>
      <Row className="small mb-2">
        <Col>Client : <b>{o.clientName}</b><br />Phone : {o.phone}<br />Site address : {o.siteAddress}</Col>
        <Col>Order No : <b>{o.orderNo}</b><br />Date : {fdate(o.date)}<br />Status : {o.status}</Col>
      </Row>
      <Table bordered size="sm" className="small">
        <thead><tr><th>SL.</th><th>SERVICE NAME</th><th className="text-end">PCS / QTY</th></tr></thead>
        <tbody>{o.items.map((it, i) => <tr key={i}><td>{i + 1}</td><td>{it.service}</td><td className="text-end">{it.qty}</td></tr>)}</tbody>
      </Table>
      {o.items.map((it, i) => !!it.specs.length && (
        <div key={i} className="mb-2">
          <div className="fw-bold small">{i + 1}. {it.service} ({it.qty} pcs)</div>
          <Table bordered size="sm" className="small mb-1">
            <thead><tr>{PRINT.map(([k, l]) => <th key={k}>{l}</th>)}</tr></thead>
            <tbody>{it.specs.map((s, j) => <tr key={j}>{PRINT.map(([k]) => <td key={k}>{s[k]}</td>)}</tr>)}</tbody>
          </Table>
        </div>))}
      {o.note && <div className="small">Note : {o.note}</div>}
      <Row className="mt-5 pt-3 text-center small">
        {['PREPARED BY', 'MISTRY / RECEIVED BY', 'AUTHORIZED BY'].map(t => <Col key={t}><div className="border-top pt-1 mx-2">{t}</div></Col>)}
      </Row>
    </PrintModal>
  );
}

export function Orders() {
  const [rows, setRows] = useState([]), [clients, setClients] = useState([]), [products, setProducts] = useState([]);
  const [fl, setFl] = useState({ q: '', status: '' });
  const [edit, setEdit] = useState(null), [print, setPrint] = useState(null), [err, setErr] = useState('');
  const load = () => api('/orders?' + new URLSearchParams(fl)).then(setRows).catch(e => setErr(e.message));
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [fl]);
  useEffect(() => { api('/clients').then(setClients); api('/products').then(setProducts); }, []);
  const open = o => setEdit({ ...o, client: o.client || '', date: String(o.date).slice(0, 10), items: o.items.map(i => ({ ...i, specs: i.specs.length ? i.specs : [blankSpec()] })) });
  const del = async o => {
    if (!confirm(`Delete ${o.orderNo}?`)) return;
    try { await api(`/orders/${o._id}`, 'DELETE'); load(); } catch (x) { setErr(x.message); }
  };
  return (
    <>
      <Row className="mb-3 g-2 align-items-center">
        <Col><h4 className="mb-0">Orders (drafts and work orders)</h4></Col>
        <Col md={3}><Form.Control placeholder="Search order, client, phone, site" value={fl.q} onChange={e => setFl({ ...fl, q: e.target.value })} /></Col>
        <Col md={2}><Form.Select value={fl.status} onChange={e => setFl({ ...fl, status: e.target.value })}><option value="">All status</option>{STATUS.map(s => <option key={s}>{s}</option>)}</Form.Select></Col>
        <Col xs="auto"><Button onClick={() => setEdit(fresh())}>New order draft</Button></Col>
      </Row>
      {err && <Alert variant="danger" dismissible onClose={() => setErr('')}>{err}</Alert>}
      <Card className="shadow-sm"><div className="table-responsive">
        <Table hover className="mb-0">
          <thead><tr><th>Order</th><th>Date</th><th>Client</th><th>Site</th><th>Services</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map(o => (
              <tr key={o._id}>
                <td><b>{o.orderNo}</b></td><td>{fdate(o.date)}</td>
                <td>{o.clientName}<div className="small text-muted">{o.phone}</div></td><td>{o.siteAddress}</td>
                <td className="small">{o.items.map(i => `${i.service} ×${i.qty}`).join(', ')}</td>
                <td><Badge bg={TONE[o.status]}>{o.status}</Badge></td>
                <td className="text-end text-nowrap">
                  <Button size="sm" className="me-1" onClick={() => setPrint(o)}>Print</Button>
                  <Button size="sm" variant="outline-secondary" className="me-1" onClick={() => open(o)}>Edit</Button>
                  <Button size="sm" variant="outline-danger" onClick={() => del(o)}>Delete</Button>
                </td>
              </tr>))}
            {!rows.length && <tr><td colSpan="7" className="text-center text-muted py-4">No orders yet. Click "New order draft".</td></tr>}
          </tbody>
        </Table>
      </div></Card>
      {edit && <OrderForm init={edit} clients={clients} products={products} onHide={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
      {print && <OrderPrint o={print} onHide={() => setPrint(null)} />}
    </>
  );
}