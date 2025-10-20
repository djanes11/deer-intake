// lib/stateform/map.ts
// Complete mapping + helpers for Indiana DNR State Form 19433 (R7)
// using YOUR sheet headers. Safe to paste as a full replacement.

/** Your current sheet headers (typing aid) */
export type JobRow = {
  "Tag"?: string;
  "Confirmation #"?: string;
  "Customer"?: string;
  "Phone"?: string;
  "Email"?: string;
  "Address"?: string;
  "City"?: string;
  "State"?: string;
  "Zip"?: string;
  "County Killed"?: string;
  "Sex"?: string;
  "Process Type"?: string;
  "Drop-off Date"?: string;
  "Status"?: string;
  "Caping Status"?: string;
  "Webbs Status"?: string;
  "Steak"?: string;
  "Steak Size (Other)"?: string;
  "Burger Size"?: string;
  "Steaks per Package"?: string;
  "Beef Fat"?: string;
  "Hind Roast Count"?: string;
  "Front Roast Count"?: string;
  "Backstrap Prep"?: string;
  "Backstrap Thickness"?: string;
  "Backstrap Thickness (Other)"?: string;
  "Notes"?: string;
  "Webbs Order"?: string;
  "Webbs Order Form Number"?: string;
  "Webbs Pounds"?: string;
  "Price"?: string;
  "Paid"?: string;
  "Specialty Products"?: string;
  "Specialty Pounds"?: string;
  "Summer Sausage (lb)"?: string;
  "Summer Sausage + Cheese (lb)"?: string;
  "Sliced Jerky (lb)"?: string;
  "Hind - Steak"?: string;
  "Hind - Roast"?: string;
  "Hind - Grind"?: string;
  "Hind - None"?: string;
  "Front - Steak"?: string;
  "Front - Roast"?: string;
  "Front - Grind"?: string;
  "Front - None"?: string;
  "Notified Ready At"?: string;
  "Public Token"?: string;
  "Public Link Sent At"?: string;
  "Drop-off Email Sent At"?: string;
  "Processing Price"?: string;
  "Specialty Price"?: string;
  "Paid Processing"?: string;
  "Paid Processing At"?: string;
  "Paid Specialty"?: string;
  "Paid Specialty At"?: string;
  "Picked Up - Processing"?: string;
  "Picked Up - Processing At"?: string;
  "Picked Up - Cape"?: string;
  "Picked Up - Cape At"?: string;
  "Picked Up - Webbs"?: string;
  "Picked Up - Webbs At"?: string;
  "Call Attempts"?: string;
  "Last Called At"?: string;
  "Last Called By"?: string;
  "Last Call Outcome"?: string;
  "Last Call At"?: string;
  "Call Notes"?: string;
  "Meat Attempts"?: string;
  "Cape Attempts"?: string;
  "Webbs Attempts"?: string;
  "Requires Tag"?: string;
  "Phone Last4"?: string;
  "Pref Email"?: string;
  "Pref SMS"?: string;
  "Pref Call"?: string;
  "SMS Consent"?: string;
  "Auto Call Consent"?: string;
  "Specialty Status"?: string;
};

export type StateFormEntry = {
  dateIn?: string;        // mm/dd/yy (we normalize)
  dateOut?: string;       // unused for now
  name?: string;
  address?: string;       // "street, city, state, zip"
  phone?: string;         // (xxx) xxx-xxxx
  sex?: string;           // BUCK | DOE | ANTLERLESS
  whereKilled?: string;   // "county, state"
  howKilled?: string;     // blank until you add it to your form
  donated?: string;       // Y | N (from Process Type)
  confirmation?: string;
};

export type StateFormPayload = {
  pageYear: string;             // "2025"
  pageNumber: number;           // running count
  processorName: string;        // Mcafee Custom Deer Processing
  processorLocation: string;    // Indiana
  processorCounty: string;      // Harrison
  processorStreet: string;      // 10977 Buffalo Trace Rd NW
  processorCity: string;        // Palmyra
  processorZip: string;         // 47164
  processorPhone: string;       // (502)643-3916
  entries: StateFormEntry[];
};

/** Defaults for header population (edit if needed) */
export const headerDefaults = {
  pageYear: "2025",
  processorName: "Mcafee Custom Deer Processing",
  processorLocation: "Indiana",
  processorCounty: "Harrison",
  processorStreet: "10977 Buffalo Trace Rd NW",
  processorCity: "Palmyra",
  processorZip: "47164",
  processorPhone: "(502)643-3916",
};

/** Map 1-based row index -> PDF field names in 19433 (R7) */
export function pdfFieldMap(i: number) {
  const n = String(i);
  return {
    dateIn: `DATE IN mmddyy${n}`,
    dateOut: `DATE OUT mmddyy${n}`,
    name: `NAME${n}`,
    address: `ADDRESS street city state ZIP code${n}`,
    phone: `TELEPHONE NUMBER${n}`,
    sex: `BUCK  DOE  ANTLERLESS${n}`,
    whereKilled: `WHERE KILLED county and state or province${n}`,
    howKilled: `HOW KILLED gun arch veh${n}`,
    donated: `DONATED TO HUNT FOR HUNGER YN${n}`,
    confirmation: `CONFIRMATION NUMBER${n}`,
  };
}

/** Header field names in the PDF */
export const headerFields = {
  year: "Year:",
  pageNumber: "Page Number:",
  processorName: "Name of processor:",
  processorLocation: "Location of processor:",
  processorCounty: "County where located:",
  processorStreet: "Processor s complete address street:",
  processorCity: "City:",
  processorZip: "ZIP code:",
};

/* -------------------------- Helpers / Normalizers -------------------------- */

function toMMDDYYFromISO(s?: string): string {
  if (!s) return "";
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(s)) return s;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const [, y, mo, d] = m;
  return `${mo}/${d}/${y.slice(-2)}`;
}

function normalizePhone(s?: string): string {
  const d = String(s || "").replace(/\D+/g, "");
  if (!d) return "";
  if (d.length === 11 && d.startsWith("1")) return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return String(s || "");
}

function mapSexToCode(sex?: string): string {
  const x = String(sex || "").trim().toLowerCase();
  if (!x) return "";
  if (x.includes("buck")) return "BUCK";
  if (x.includes("doe")) return "DOE";
  return "ANTLERLESS";
}

function buildAddress(row: JobRow): string {
  const left = (row["Address"] || "").trim();
  const right = [row["City"], row["State"], row["Zip"]].filter(Boolean).join(", ");
  return [left, right].filter(Boolean).join(", ");
}

function buildWhereKilled(row: JobRow): string {
  const county = (row["County Killed"] || "").trim();
  const st = (row["State"] || "").trim() || "IN";
  return [county, st].filter(Boolean).join(", ");
}

function isDonatedByProcessType(pt?: string): boolean {
  const x = String(pt || "").trim().toLowerCase();
  return (
    x === "donate" ||
    x === "donte" ||        // tolerate typo
    x === "cape and donate" ||
    x === "cape & donate"
  );
}

/* -------------------------- Row Converters -------------------------- */

export function entryFromJobRow(row: JobRow): StateFormEntry {
  return {
    dateIn: toMMDDYYFromISO(row["Drop-off Date"]),
    dateOut: "",
    name: row["Customer"] || "",
    address: buildAddress(row),
    phone: normalizePhone(row["Phone"]),
    sex: mapSexToCode(row["Sex"]),
    whereKilled: buildWhereKilled(row),
    howKilled: "", // not captured yet
    donated: isDonatedByProcessType(row["Process Type"]) ? "Y" : "N",
    confirmation: row["Confirmation #"] || "",
  };
}

export function entriesFromSheetRows(rows: JobRow[]): StateFormEntry[] {
  return rows.map(entryFromJobRow);
}

