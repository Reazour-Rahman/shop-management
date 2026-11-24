const { Schema, model, models } = require("mongoose");
const ref = (n) => ({ type: Schema.Types.ObjectId, ref: n });

const Sale =
  models.Sale ||
  model(
    "Sale",
    new Schema(
      {
        invoiceNo: { type: String, unique: true },
        saleType: { type: String, enum: ["product", "service"], default: "product" },
        returned: { type: Number, default: 0 }, // total value of goods returned against this invoice (due = total - returned - waived - paid)
        waived: { type: Number, default: 0 }, // Moukuf: part of the due that the shop gave up (the client no longer owes it)
        waivedAt: Date,
        waivedNote: String,
        client: { ...ref("Client"), required: true },
        date: { type: Date, default: Date.now },
        items: [
          {
            product: ref("Product"),
            name: String,
            unit: String,
            brand: String,
            thickness: String,
            color: String,
            size: String,
            grade: String,
            lth: Number, // Product Sale: typed as is
            wth: Number,
            pcs: Number,
            sizes: [{ _id: false, lthMm: Number, wthMm: Number, lthFt: Number, wthFt: Number, pcs: Number, qty: Number }], // Service Sale: every window size of this line
            lthMm: Number, // Service Sale: original MM typed by the operator (first size)
            wthMm: Number,
            lthFt: Number, // Service Sale: feet shown to the customer (0.5 ft steps)
            wthFt: Number,
            discountType: String, // Service Sale: "%" or "৳" as typed
            discountValue: Number,
            qty: Number,
            price: Number,
            discount: Number,
            total: Number,
            unitCost: Number,
            isService: Boolean,
            isContract: Boolean,
          },
        ],
        materials: [
          {
            product: ref("Product"),
            name: String,
            unit: String,
            brand: String,
            size: String,
            thickness: String,
            color: String,
            grade: String,
            pcs: Number, // pieces taken from the product's PCS counter
            qty: Number,
            price: Number,
            cost: Number,
          },
        ],
        total: Number,
        paid: { type: Number, default: 0 },
        due: Number,
        paidAtSale: Number, // amount received when the invoice was made (printed on the memo)
        status: {
          type: String,
          enum: ["Paid", "Partial", "Due"],
          default: "Due",
        },
        note: String,
        salesPerson: String,
        orderNo: String,
        ledgerNo: String,
      },
      { timestamps: true },
    ),
  );

const Payment =
  models.Payment ||
  model(
    "Payment",
    new Schema(
      {
        client: ref("Client"),
        sale: ref("Sale"),
        amount: Number, // negative for money paid back to the client
        method: String,
        kind: { type: String, enum: ["payment", "refund", "credit"], default: "payment" }, // refund = cash paid back, credit = moved between invoices in an exchange
        ret: ref("SaleReturn"),
        date: { type: Date, default: Date.now },
      },
      { timestamps: true },
    ),
  );

// Every stock change is logged here (qty is negative for sales). Purchases will use it in Phase 3.
const StockMove =
  models.StockMove ||
  model(
    "StockMove",
    new Schema(
      {
        product: ref("Product"),
        type: String,
        qty: Number,
        cost: Number,
        ref: String,
        date: { type: Date, default: Date.now },
      },
      { timestamps: true },
    ),
  );

// A return (credit note) against one invoice. The invoice itself is never changed except for its returned / paid / due figures.
const SaleReturn =
  models.SaleReturn ||
  model(
    "SaleReturn",
    new Schema(
      {
        returnNo: { type: String, unique: true },
        sale: ref("Sale"),
        client: ref("Client"),
        date: { type: Date, default: Date.now },
        items: [
          {
            _id: false,
            index: Number, // which line of the invoice
            product: ref("Product"),
            name: String, unit: String, brand: String, thickness: String, color: String, size: String, grade: String,
            qty: Number, pcs: Number, price: Number, total: Number,
            restock: Boolean, // goods went back to stock
            unitCost: Number, isService: Boolean,
          },
        ],
        total: Number,
        fromDue: Number, // part of the return that reduced what the client still owed
        credit: Number, // part moved to the exchange invoice
        refunded: Number, // part paid back in cash
        refundMethod: String,
        exchangeSale: ref("Sale"),
        note: String,
      },
      { timestamps: true },
    ),
  );

// Dropdown values that the operator added (brand, size, color, service name) for the Service Sale form
const Option =
  models.Option ||
  model(
    "Option",
    new Schema(
      {
        kind: { type: String, enum: ["brand", "size", "color", "service"], required: true },
        value: { type: String, required: true, trim: true },
      },
      { timestamps: true },
    ),
  );

module.exports = { Sale, Payment, StockMove, Option, SaleReturn };
