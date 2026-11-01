import PDFDocument from 'pdfkit';
import type { Writable } from 'node:stream';
import { effectiveLineQty, formatQty, type UnitType } from '@sabjiilelo/shared';

export interface InvoiceData {
  kind: 'BILL' | 'PACKING_SLIP';
  invoiceNo: string | null;
  orderNo: string;
  date: Date;
  area: { name: string; city: string };
  customer: { name: string | null; phone: string | null; address: string | null };
  slot: string | null;
  paymentMode: string;
  paymentStatus: string;
  items: {
    name: string;
    variantLabel: string;
    unitType: UnitType;
    baseQty: number;
    qty: number;
    packedQty: number | null;
    rejectedQty: number;
    pricePaise: number;
    hsnCode: string | null;
  }[];
  subtotalPaise: number;
  discountPaise: number;
  deliveryFeePaise: number;
  finalPayablePaise: number;
  refundedPaise: number;
}

// Built-in PDF fonts have no rupee glyph, so amounts print as "Rs.".
const rs = (paise: number) => `Rs. ${(paise / 100).toFixed(2)}`;
const GREEN = '#0e5a32';

export function renderInvoice(data: InvoiceData, out: Writable) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  doc.pipe(out);

  doc.fillColor(GREEN).fontSize(22).font('Helvetica-Bold').text('Sabjii Le Lo', 40, 40);
  doc.fillColor('#555').fontSize(9).font('Helvetica').text(`Fresh vegetables & fruits · ${data.area.name}, ${data.area.city}`);
  doc
    .fillColor('#0b1a10')
    .fontSize(14)
    .font('Helvetica-Bold')
    .text(data.kind === 'BILL' ? 'BILL OF SUPPLY' : 'PACKING SLIP', 0, 44, { align: 'right' });
  doc.fontSize(9).font('Helvetica').fillColor('#333');
  const meta = [
    data.invoiceNo && data.kind === 'BILL' ? `Bill No: ${data.invoiceNo}` : null,
    `Order: ${data.orderNo}`,
    `Date: ${data.date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
    data.slot ? `Slot: ${data.slot}` : null,
  ].filter(Boolean) as string[];
  doc.text(meta.join('\n'), 0, 64, { align: 'right' });

  doc.moveTo(40, 120).lineTo(555, 120).strokeColor('#e6dfcf').stroke();
  doc.fillColor('#0b1a10').font('Helvetica-Bold').fontSize(10).text('Deliver to', 40, 130);
  doc
    .font('Helvetica')
    .fontSize(9)
    .text([data.customer.name, data.customer.phone, data.customer.address].filter(Boolean).join('\n') || 'Walk-in customer', 40, 145, {
      width: 300,
    });
  doc.font('Helvetica-Bold').fontSize(10).text('Payment', 380, 130);
  doc.font('Helvetica').fontSize(9).text(`${data.paymentMode} · ${data.paymentStatus}`, 380, 145);

  let y = 205;
  const cols = data.kind === 'BILL' ? [40, 230, 300, 360, 420, 490] : [40, 300, 400, 480];
  const headers = data.kind === 'BILL' ? ['Item', 'HSN', 'Pack', 'Qty', 'Rate', 'Amount'] : ['Item', 'Pack', 'Ordered', 'Pack qty'];
  doc.rect(40, y - 4, 515, 18).fill('#d9f2e0');
  doc.fillColor('#0b1a10').font('Helvetica-Bold').fontSize(9);
  headers.forEach((h, i) => doc.text(h, cols[i]!, y));
  y += 20;
  doc.font('Helvetica').fontSize(9);

  for (const it of data.items) {
    if (y > 740) {
      doc.addPage();
      y = 50;
    }
    const qty = effectiveLineQty(it);
    if (data.kind === 'BILL') {
      doc.text(it.name, cols[0]!, y, { width: 185 });
      doc.text(it.hsnCode ?? '-', cols[1]!, y);
      doc.text(it.variantLabel, cols[2]!, y);
      doc.text(String(qty) + (qty !== it.qty ? ` (of ${it.qty})` : ''), cols[3]!, y);
      doc.text(rs(it.pricePaise), cols[4]!, y);
      doc.text(rs(it.pricePaise * qty), cols[5]!, y);
    } else {
      doc.text(`${it.name}  (${formatQty(it.unitType, it.baseQty * it.qty)})`, cols[0]!, y, { width: 255 });
      doc.text(it.variantLabel, cols[1]!, y);
      doc.text(String(it.qty), cols[2]!, y);
      doc.text('______', cols[3]!, y);
    }
    y += 18;
  }

  if (data.kind === 'BILL') {
    y += 10;
    doc.moveTo(330, y).lineTo(555, y).strokeColor('#e6dfcf').stroke();
    y += 8;
    const effSubtotal = data.items.reduce((s, it) => s + it.pricePaise * effectiveLineQty(it), 0);
    const rows: [string, string][] = [
      ['Item total', rs(effSubtotal)],
      ['Discount', `- ${rs(Math.min(data.discountPaise, effSubtotal))}`],
      ['Delivery fee', rs(effSubtotal > 0 ? data.deliveryFeePaise : 0)],
    ];
    if (data.refundedPaise > 0) rows.push(['Refunded', rs(data.refundedPaise)]);
    for (const [k, v] of rows) {
      doc.font('Helvetica').text(k, 330, y).text(v, 490, y);
      y += 16;
    }
    doc.font('Helvetica-Bold').fontSize(11).fillColor(GREEN).text('Amount payable', 330, y).text(rs(data.finalPayablePaise), 490, y);
    y += 30;
    doc
      .fillColor('#777')
      .font('Helvetica')
      .fontSize(8)
      .text(
        'Bill of Supply. Supplier not registered under GST. Fresh fruits and vegetables are exempt supplies. ' +
          'Freshness promise: anything not fresh can be returned to the delivery partner at your door.',
        40,
        y,
        { width: 515 },
      );
  }
  doc.end();
}
