// lib/stateform/map.ts

/**
 * Header fields for Indiana State Form 19433.
 * Update each string to the EXACT form field name in your PDF.
 * Use /api/stateform/render?dry=1&debug=1 to dump all names if unsure.
 */
export const headerFields = {
  year: "Year",                                    // e.g. might actually be "Text1"
  pageNumber: "Page Number",                       // e.g. "Text2"
  processorName: "Name of processor",              // e.g. "Text3"
  processorLocation: "Location of processor",      // e.g. "Text4"
  processorCounty: "County where located",         // e.g. "Text5"
  processorStreet: "Processor's complete address (street)", // e.g. "Text6"
  processorCity: "City",                           // e.g. "Text7"
  processorZip: "ZIP code",                        // e.g. "Text8"
  processorPhone: "Area code and telephone number" // e.g. "Text9"
};

/**
 * Field names for each of the 44 line items.
 * Many official PDFs use a per-row naming convention like NAME_1, NAME_2, ...
 * If your PDF uses different names, update the patterns here to match.
 */
export function pdfFieldMap(i: number) {
  // Sanity clamp; the form only has 44 lines.
  const idx = Math.max(1, Math.min(44, i));

  return {
    // Dates
    dateIn: `DATE IN_${idx}`,          // e.g. could be "DATE IN (mm/dd/yy)_${idx}" or "Text_100_${idx}"
    dateOut: `DATE OUT_${idx}`,

    // Owner info
    name: `NAME_${idx}`,
    address: `ADDRESS_${idx}`,         // include street, city, state, ZIP in the same field per form instruction
    phone: `TELEPHONE NUMBER_${idx}`,

    // Deer details
    sex: `BUCK / DOE / ANTLERLESS_${idx}`, // often a text field; some PDFs split to checkboxes

    // Harvest info
    whereKilled: `WHERE KILLED_${idx}`,    // (county and state or province)
    howKilled: `HOW KILLED_${idx}`,        // (gun, arch., veh.)

    // Donation + confirmation
    donated: `DONATED TO HUNT FOR HUNGER?_${idx}`, // usually "Y" / "N" text
    confirmation: `CONFIRMATION NUMBER_${idx}`,
  };
}

/**
 * If your PDF uses totally different names (no suffixes), here’s an example
 * of a fixed-name mapping for row 1 you can copy/extend:
 *
 * export function pdfFieldMap(i: number) {
 *   const mapOne = {
 *     dateIn: "DateIn_1",
 *     dateOut: "DateOut_1",
 *     name: "Name_1",
 *     address: "Address_1",
 *     phone: "Phone_1",
 *     sex: "Sex_1",
 *     whereKilled: "WhereKilled_1",
 *     howKilled: "HowKilled_1",
 *     donated: "Donated_1",
 *     confirmation: "Confirmation_1",
 *   };
 *   const n = Math.max(1, Math.min(44, i));
 *   // if your fields are literally unique per row, compute names here instead
 *   return Object.fromEntries(Object.entries(mapOne).map(([k, v]) => [k, v.replace("_1", `_${n}`)])) as typeof mapOne;
 * }
 */
