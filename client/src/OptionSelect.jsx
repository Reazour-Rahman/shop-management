import { useState } from "react";
import { Button, Form } from "react-bootstrap";

// A dropdown that also lets the operator add a new value ("+ Add new…").
// onCreate(text) must save the value and return the saved text; the new value is then selected.
export default function OptionSelect({
  value,
  options,
  onChange,
  onCreate,
  placeholder = "Choose…",
  required,
}) {
  const [adding, setAdding] = useState(false),
    [text, setText] = useState(""),
    [err, setErr] = useState("");

  const stop = () => {
    setAdding(false);
    setText("");
    setErr("");
  };
  const confirm = async () => {
    const v = text.trim();
    if (!v) return stop();
    try {
      onChange(await onCreate(v));
      stop();
    } catch (x) {
      setErr(x.message);
    }
  };

  if (adding)
    return (
      <div>
        <div className="d-flex gap-1">
          <Form.Control
            size="sm"
            autoFocus
            placeholder="New value"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirm();
              }
              if (e.key === "Escape") stop();
            }}
          />
          <Button size="sm" onClick={confirm} title="Save this value">
            ✓
          </Button>
          <Button size="sm" variant="light" onClick={stop} title="Cancel">
            ×
          </Button>
        </div>
        {err && <div className="small text-danger">{err}</div>}
      </div>
    );

  return (
    <Form.Select
      size="sm"
      required={required}
      value={value || ""}
      onChange={(e) =>
        e.target.value === "__new" ? setAdding(true) : onChange(e.target.value)
      }
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
      {value && !options.includes(value) && <option value={value}>{value}</option>}
      <option value="__new">+ Add new…</option>
    </Form.Select>
  );
}
