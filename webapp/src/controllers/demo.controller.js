import bwipjs from 'bwip-js';
import QRCode from 'qrcode';
import * as productModel from '../models/product.model.js';
import { CATEGORY_COPY } from '../lib/shopperCopy.js';
import { ah } from '../lib/asyncHandler.js';

/** Seeded demo personas (see src/scripts/seed.js). Tokens only — no PHI on this page. */
const DEMO_CLIENTS = [
  { token: 'MTG-1001', profile: 'Diabetes + high blood pressure · household of 4' },
  { token: 'MTG-1002', profile: 'Kidney disease + high blood pressure · household of 3' },
  { token: 'MTG-1003', profile: 'Diabetes + kidney disease + high blood pressure, dairy allergy · household of 5' },
  { token: 'MTG-1004', profile: 'Heart failure + high blood pressure + diabetes · household of 2' },
  { token: 'MTG-1005', profile: 'High blood pressure, gluten allergy · household of 6' },
];

// Code 128 encodes the SKU exactly, so a scan returns the same value the app looks up.
const barcodeSvg = (text) =>
  bwipjs.toSVG({ bcid: 'code128', text, scale: 2, height: 10, includetext: true, textxalign: 'center', paddingwidth: 6 });

const svgDataUrl = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

/** Printable sheet of shelf-tag barcodes and client card QR codes for demos and testing. */
export const showBarcodes = ah(async (req, res) => {
  const products = await productModel.listActive();

  const groups = new Map();
  for (const product of products) {
    const list = groups.get(product.category) || [];
    list.push({
      sku: product.sku,
      name: product.name,
      location: `Aisle ${product.aisle} · Shelf ${product.shelf} · Bin ${product.bin}`,
      barcode: svgDataUrl(barcodeSvg(product.sku)),
    });
    groups.set(product.category, list);
  }

  const clients = await Promise.all(
    DEMO_CLIENTS.map(async (client) => ({
      ...client,
      qr: await QRCode.toDataURL(client.token, { margin: 1, width: 180 }),
    })),
  );

  res.render('barcodes', {
    title: 'Demo barcodes',
    bodyClass: 'barcodes',
    clients,
    groups: [...groups.entries()].map(([category, items]) => ({
      category,
      label: CATEGORY_COPY[category] || category,
      items,
    })),
  });
});
