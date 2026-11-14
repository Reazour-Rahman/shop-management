import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Table, Row, Col, Form, Alert, ProgressBar } from 'react-bootstrap';
import { api } from './api';
import { money, today } from './Sales.jsx';

const Stat = ({ label, value, tone, sub }) => (
  <Col sm={6} xl={3}><Card className="stat shadow-sm h-100"><Card.Body>
    <div className="text-muted small">{label}</div><div className={'fs-4 fw-semibold ' + (tone || '')}>{value}</div>{sub && <div className="small text-muted">{sub}</div>}
  </Card.Body></Card></Col>
);

function Bars({ data }) {
  const max = Math.max(1, ...data.map(d => d.total));
  return (<>
    <div className="d-flex align-items-end gap-1" style={{ height: 150 }}>
      {data.map(d => <div key={d.date} title={`${d.date}: ${money(d.total)}`}
        style={{ flex: 1, height: Math.max(2, (d.total / max) * 100) + '%', background: d.total ? 'var(--bs-primary)' : '#d5e0e0', borderRadius: '3px 3px 0 0' }} />)}
    </div>
    <div className="d-flex justify-content-between small text-muted mt-1"><span>{data[0]?.date}</span><span>{data[data.length - 1]?.date}</span></div>
  </>);
}

export function Dashboard() {
  const [d, setD] = useState(null), [err, setErr] = useState('');
  useEffect(() => { api('/dashboard?today=' + today()).then(setD).catch(e => setErr(e.message)); }, []);
  if (err) return <Alert variant="danger">{err}</Alert>;
  if (!d) return <p className="text-muted">Loading…</p>;
  const QA = [['New sale', '/sales?new=1'], ['New purchase', '/purchases?new=1'], ['Payment received', '/dues'],
    ['Supplier payment', '/suppliers'], ['Salary payment', '/salary'], ['New expense', '/expenses?new=1']];
  const tot = d.monthPaid + d.monthDue;
  return (
    <>
      <div className="d-flex flex-wrap gap-2 mb-4">{QA.map(([l, to]) => <Button key={l} as={Link} to={to} variant="outline-primary">{l}</Button>)}</div>
      <Row className="g-3 mb-4">
        <Stat label="Today's sales" value={money(d.todaySales)} />
        <Stat label="This month's sales" value={money(d.monthSales)} />
        <Stat label="Total client due" value={money(d.clientDue)} tone="text-danger" />
        <Stat label="Total supplier payable" value={money(d.payable)} tone="text-danger" />
        <Stat label="Total salary due" value={money(d.salaryDue)} tone="text-danger" />
        <Stat label="This month's other expenses" value={money(d.monthExpense)} />
        <Stat label="Net income (lifetime)" value={money(d.lifetimeNet)} tone={d.lifetimeNet < 0 ? 'text-danger' : 'text-success'} />
        <Stat label="Low stock items" value={d.low.length} tone={d.low.length ? 'text-danger' : ''} sub={d.low.length ? 'See list below' : 'All stock is fine'} />
      </Row>
      <Row className="g-3">
        <Col lg={8}><Card className="shadow-sm h-100"><Card.Body><h6>Daily sales, last 30 days</h6><Bars data={d.series} /></Card.Body></Card></Col>
        <Col lg={4}><Card className="shadow-sm h-100"><Card.Body>
          <h6>This month: paid vs due</h6>
          <ProgressBar className="my-3" style={{ height: 18 }}>
            <ProgressBar variant="success" now={tot ? (d.monthPaid / tot) * 100 : 0} /><ProgressBar variant="danger" now={tot ? (d.monthDue / tot) * 100 : 0} /></ProgressBar>
          <div className="text-success">Paid {money(d.monthPaid)}</div><div className="text-danger">Due {money(d.monthDue)}</div>
        </Card.Body></Card></Col>
      </Row>
      {!!d.low.length && <Alert variant="danger" className="mt-4"><b>Low stock:</b> {d.low.map(p => `${p.label || p.name} (${p.stock} ${p.unit})`).join(', ')}</Alert>}
    </>
  );
}

const L = ({ label, value, bold, indent, tone }) => (
  <tr className={bold ? 'fw-bold' : ''}><td style={{ paddingLeft: indent ? 28 : undefined }}>{label}</td><td className={'text-end ' + (tone || '')}>{money(value)}</td></tr>
);
const month = () => ({ from: today().slice(0, 7) + '-01', to: today() });

export function IncomeStatement() {
  const [r, setR] = useState(month()), [s, setS] = useState(null), [err, setErr] = useState('');
  const [a, setA] = useState(month()), [b, setB] = useState(month()), [cmp, setCmp] = useState(null);
  useEffect(() => { api('/income-statement?' + new URLSearchParams(r)).then(setS).catch(e => setErr(e.message)); }, [r]);
  const compare = async () => setCmp([await api('/income-statement?' + new URLSearchParams(a)), await api('/income-statement?' + new URLSearchParams(b))]);
  const Range = ({ v, set }) => (<>
    <Col md={3}><Form.Control type="date" value={v.from} onChange={e => set({ ...v, from: e.target.value })} /></Col>
    <Col md={3}><Form.Control type="date" value={v.to} onChange={e => set({ ...v, to: e.target.value })} /></Col></>);
  return (
    <>
      <Row className="g-2 mb-3 no-print"><Range v={r} set={setR} />
        <Col md="auto"><Button variant="outline-primary" onClick={() => setR(month())}>This month</Button></Col>
        <Col md="auto"><Button variant="outline-primary" onClick={() => setR({ from: '', to: '' })}>All time</Button></Col></Row>
      {err && <Alert variant="danger">{err}</Alert>}
      {s && <Card className="shadow-sm mb-4" style={{ maxWidth: 640 }}><Card.Body>
        <h5>Income statement</h5><div className="text-muted small mb-2">{r.from || 'Start'} to {r.to || 'today'}</div>
        <Table size="sm" className="mb-0"><tbody>
          <L label="Net sales" value={s.revenue} bold />
          <L label="Less: Cost of goods sold" value={s.cogs} bold />
          <L label="Beginning inventory" value={s.beginInv} indent />
          <L label="+ Purchases" value={s.purchases} indent />
          {s.opening > 0 && <L label="+ Opening stock added" value={s.opening} indent />}
          <L label="− Ending inventory" value={s.endInv} indent />
          <L label={`Gross profit${s.revenue ? ` (${((s.gross / s.revenue) * 100).toFixed(1)}%)` : ''}`} value={s.gross} bold tone={s.gross < 0 ? 'text-danger' : ''} />
          <L label="Less: Operating expenses" value={s.opex} bold />
          <L label="Salary (months in this period)" value={s.salary} indent />
          <L label="Other expenses" value={s.other} indent />
          {s.categories.map(c => <L key={c.category} label={c.category} value={c.total} indent />)}
          <L label="Net income" value={s.net} bold tone={s.net < 0 ? 'text-danger' : 'text-success'} />
        </tbody></Table>
      </Card.Body></Card>}
      {s && <Card className="shadow-sm mb-4" style={{ maxWidth: 640 }}><Card.Body>
        <h5>Cash flow (money actually moved)</h5>
        <Table size="sm" className="mb-0"><tbody>
          <L label="Received from clients" value={s.cash.in} />
          <L label="Paid to suppliers" value={-s.cash.suppliers} />
          <L label="Salary paid" value={-s.cash.salary} />
          <L label="Other expenses paid" value={-s.cash.other} />
          <L label="Net cash flow" value={s.cash.net} bold tone={s.cash.net < 0 ? 'text-danger' : 'text-success'} />
        </tbody></Table>
      </Card.Body></Card>}
      <Card className="shadow-sm no-print" style={{ maxWidth: 640 }}><Card.Body>
        <h6>Compare sales of two periods</h6>
        <Row className="g-2 mb-2"><Range v={a} set={setA} /></Row>
        <Row className="g-2 mb-3"><Range v={b} set={setB} /><Col md="auto"><Button onClick={compare}>Compare</Button></Col></Row>
        {cmp && <Table size="sm" className="mb-0"><tbody>
          <L label="Period 1 sales" value={cmp[0].revenue} /><L label="Period 2 sales" value={cmp[1].revenue} />
          <L label="Difference (period 2 minus 1)" value={cmp[1].revenue - cmp[0].revenue} bold tone={cmp[1].revenue < cmp[0].revenue ? 'text-danger' : 'text-success'} />
        </tbody></Table>}
      </Card.Body></Card>
    </>
  );
}
