// Számlázz.hu Számla Agent — tiszta (szerver-import nélküli) segédfüggvények:
// XML-összeállítás, cím-bontás, ÁFA-kód és a válasz feldolgozása. A hálózati
// hívás a `szamlazz-server.ts`-ben van. XSD: https://www.szamlazz.hu/szamla/docs/xsds/agent/xmlszamla.xsd
// (az elemek SORRENDJE kötött — a sémában sequence).

import type { Currency, DocType, PaymentMethod } from "./finance";

export const SZAMLAZZ_ENDPOINT = "https://www.szamlazz.hu/szamla/";

/** A Számlázz.hu által elfogadott ÁFA-kódok, amelyeket a felületen választani lehet. */
export const SZAMLAZZ_VAT_CODES: { value: string; label: string }[] = [
  { value: "27", label: "27%" },
  { value: "18", label: "18%" },
  { value: "5", label: "5%" },
  { value: "0", label: "0%" },
  { value: "TAM", label: "TAM — tárgyi adómentes (pl. lakásbérbeadás)" },
  { value: "AAM", label: "AAM — alanyi adómentes" },
];

/** A tételen tárolt ÁFA-kulcsból a javasolt kód (0 → TAM, nincs ÁFA → AAM). */
export function defaultVatCode(vatRate: number | null): string {
  if (vatRate === null) return "AAM";
  const n = Number(vatRate);
  if (n === 0) return "TAM";
  return String(n);
}

export function isPercentVatCode(code: string): boolean {
  return /^\d+(\.\d+)?$/.test(code);
}

const PAYMENT_METHOD_TEXT: Record<PaymentMethod, string> = {
  transfer: "Átutalás",
  card: "Bankkártya",
  cash: "Készpénz",
};

/**
 * Egysoros magyar cím bontása irányítószám / település / cím részre:
 * „4025 Debrecen, Piac u. 1.” vagy „Debrecen 4025, Piac u. 1.” → { zip, city, street }.
 * Ha nem ismerhető fel, null — ilyenkor a felületen kézzel kell megadni.
 */
export function parseHungarianAddress(address: string | null | undefined): { zip: string; city: string; street: string } | null {
  const a = (address ?? "").replace(/\s+/g, " ").trim();
  if (!a) return null;
  let m = a.match(/^(?:H-)?(\d{4})\s+([^,]+?),?\s+(.+)$/i);
  // Vessző nélkül („4025 Debrecen Piac u. 1.”) a település az első szó
  if (m) return { zip: m[1], city: m[2].trim(), street: m[3].trim() };
  m = a.match(/^([^,\d]+?)\s+(\d{4}),?\s+(.+)$/);
  if (m) return { zip: m[2], city: m[1].trim(), street: m[3].trim() };
  return null;
}

/**
 * Vevő adóalany-típusa a Számlázz.hu szerint:
 * 1 = belföldi, adószámmal rendelkező · -1 = nincs adószáma (magánszemély) · 0 = nem tudjuk.
 */
export function buyerTaxSubject(taxNumber: string | null | undefined, isPerson: boolean): number {
  if (taxNumber && taxNumber.trim()) return 1;
  return isPerson ? -1 : 0;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function el(name: string, value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return `<${name}>${escapeXml(String(value))}</${name}>`;
}

function num(n: number): string {
  // Számlázz.hu double: pont a tizedesjel, max 2 tizedes
  return (Math.round(n * 100) / 100).toFixed(2);
}

export type SzamlazzInvoiceInput = {
  agentKey: string;
  eInvoice: boolean;
  prefix: string | null;
  docType: Extract<DocType, "invoice" | "proforma">;
  issueDate: string;
  fulfillmentDate: string;
  dueDate: string;
  paymentMethod: PaymentMethod;
  currency: Currency;
  note: string | null;
  seller: { bankName: string | null; bankAccount: string | null };
  buyer: {
    name: string;
    zip: string;
    city: string;
    street: string;
    email: string | null;
    sendEmail: boolean;
    taxNumber: string | null;
    taxSubject: number;
  };
  item: {
    name: string;
    note: string | null;
    unit: string;
    net: number;
    vatCode: string;
    vat: number;
    gross: number;
  };
};

/** A számlakészítő XML (xmlszamla) — PDF-et kérünk vissza XML-válaszban (valaszVerzio=2). */
export function buildInvoiceXml(i: SzamlazzInvoiceInput): string {
  const vat = isPercentVatCode(i.item.vatCode) ? i.item.vat : 0;
  const gross = isPercentVatCode(i.item.vatCode) ? i.item.gross : i.item.net;
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<xmlszamla xmlns="http://www.szamlazz.hu/xmlszamla" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamla https://www.szamlazz.hu/szamla/docs/xsds/agent/xmlszamla.xsd">`,
    `<beallitasok>`,
    el("szamlaagentkulcs", i.agentKey),
    el("eszamla", i.eInvoice),
    el("szamlaLetoltes", true),
    el("valaszVerzio", 2),
    `</beallitasok>`,
    `<fejlec>`,
    el("keltDatum", i.issueDate),
    el("teljesitesDatum", i.fulfillmentDate),
    el("fizetesiHataridoDatum", i.dueDate),
    el("fizmod", PAYMENT_METHOD_TEXT[i.paymentMethod]),
    el("penznem", i.currency),
    el("szamlaNyelve", "hu"),
    el("megjegyzes", i.note),
    // EUR-nál 0 árfolyam = a Számlázz.hu az MNB napi árfolyamát használja
    ...(i.currency === "EUR" ? [el("arfolyamBank", "MNB"), el("arfolyam", 0)] : []),
    ...(i.docType === "proforma" ? [el("dijbekero", true)] : []),
    el("szamlaszamElotag", i.prefix),
    `</fejlec>`,
    `<elado>`,
    el("bank", i.seller.bankName),
    el("bankszamlaszam", i.seller.bankAccount),
    `</elado>`,
    `<vevo>`,
    el("nev", i.buyer.name),
    el("irsz", i.buyer.zip),
    el("telepules", i.buyer.city),
    el("cim", i.buyer.street),
    el("email", i.buyer.email),
    el("sendEmail", Boolean(i.buyer.email) && i.buyer.sendEmail),
    el("adoalany", i.buyer.taxSubject),
    el("adoszam", i.buyer.taxNumber),
    `</vevo>`,
    `<tetelek>`,
    `<tetel>`,
    el("megnevezes", i.item.name),
    el("mennyiseg", "1.0"),
    el("mennyisegiEgyseg", i.item.unit),
    el("nettoEgysegar", num(i.item.net)),
    el("afakulcs", i.item.vatCode),
    el("nettoErtek", num(i.item.net)),
    el("afaErtek", num(vat)),
    el("bruttoErtek", num(gross)),
    el("megjegyzes", i.item.note),
    `</tetel>`,
    `</tetelek>`,
    `</xmlszamla>`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Kulcs-ellenőrzéshez: egy nem létező számla lekérdezése (xmlszamlaxml). */
export function buildQueryXml(agentKey: string, invoiceNumber: string): string {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<xmlszamlaxml xmlns="http://www.szamlazz.hu/xmlszamlaxml" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamlaxml https://www.szamlazz.hu/szamla/docs/xsds/agentxml/xmlszamlaxml.xsd">`,
    el("szamlaagentkulcs", agentKey),
    el("szamlaszam", invoiceNumber),
    `</xmlszamlaxml>`,
  ].join("\n");
}

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`));
  return m ? m[1].trim() : null;
}

export type SzamlazzResult =
  | { ok: true; invoiceNumber: string; pdfBase64: string | null; net: number | null; gross: number | null }
  | { ok: false; code: string | null; message: string };

function decodeHeader(v: string | null): string | null {
  if (!v) return null;
  try {
    return decodeURIComponent(v.replace(/\+/g, " "));
  } catch {
    return v;
  }
}

/** A válasz értelmezése: a fejlécek (szlahu_*) és az XML-törzs (xmlszamlavalasz) alapján. */
export function parseInvoiceResponse(headers: { get(name: string): string | null }, body: string): SzamlazzResult {
  const headerError = decodeHeader(headers.get("szlahu_error"));
  const headerCode = headers.get("szlahu_error_code");
  const success = tag(body, "sikeres");
  if (headerError || headerCode || success === "false") {
    return {
      ok: false,
      code: headerCode ?? tag(body, "hibakod"),
      message: headerError ?? tag(body, "hibauzenet") ?? (body.startsWith("[ERR]") ? body.slice(5).trim() : "Ismeretlen hiba a Számlázz.hu-n"),
    };
  }
  const number = decodeHeader(headers.get("szlahu_szamlaszam")) ?? tag(body, "szamlaszam");
  if (!number) return { ok: false, code: null, message: "A Számlázz.hu nem adott vissza számlaszámot" };
  const toNum = (v: string | null) => (v && !Number.isNaN(Number(v)) ? Number(v) : null);
  return {
    ok: true,
    invoiceNumber: number,
    pdfBase64: tag(body, "pdf")?.replace(/\s+/g, "") || null,
    net: toNum(headers.get("szlahu_nettovegosszeg") ?? tag(body, "szamlanetto")),
    gross: toNum(headers.get("szlahu_bruttovegosszeg") ?? tag(body, "szamlabrutto")),
  };
}

/** Közérthető magyarázat a leggyakoribb hibákhoz (a nyers üzenet mellé). */
export function explainSzamlazzError(message: string): string | null {
  const m = message.toLowerCase();
  if (m.includes("kulcs") || m.includes("bejelentkez") || m.includes("login") || m.includes("jelszó")) {
    return "Az Agent-kulcs hibás vagy visszavonták — a cég adatlapján add meg újra (Számlázz.hu → Beállítások → Számla Agent kulcsok).";
  }
  if (m.includes("irányítószám") || m.includes("irsz") || m.includes("település") || m.includes("cím")) {
    return "A vevő címe hiányos — írd be az irányítószámot, a települést és az utcát.";
  }
  if (m.includes("adószám")) return "A vevő adószáma hibás formátumú (helyes: 12345678-1-23).";
  if (m.includes("előtag") || m.includes("elotag")) {
    return "A számlaszám-előtag nincs felvéve a Számlázz.hu fiókban — vedd fel ott, vagy hagyd üresen a cég beállításainál.";
  }
  return null;
}
