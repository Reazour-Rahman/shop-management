const { Schema, model, models } = require("mongoose");
const ref = (n) => ({ type: Schema.Types.ObjectId, ref: n });

const Sale =
  models.Sale ||
  model(
    "Sale",
    new Schema(
      {
        invoiceNo: { type: String, unique: true },
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
        amount: Number,
        method: String,
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

module.exports = { Sale, Payment, StockMove };
