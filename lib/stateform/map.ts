// lib/stateform/map.ts

/** Header fields — exact field names from the fillable PDF. */
export const headerFields = {
  year: "Year",
  pageNumber: "Page Number",
  processorName: "Name of processor",
  processorLocation: "Location of processor",
  processorCounty: "County where located",
  // NOTE: the PDF removed the apostrophe in the field name
  processorStreet: "Processor s complete address street",
  processorCity: "City",
  processorZip: "ZIP code",
  // Phone is split into two fields in this PDF:
  processorAreaCode: "Area Code",
  processorPhoneNumber: "Phone Number",
};

/** Row fields for i in [1..44]. These are the actual names in the PDF. */
export function pdfFieldMap(i: number) {
  const idx = Math.max(1, Math.min(44, i));
  return {
    // Yes, DATE IN is literally the number string: "1", "2", ... "44"
    dateIn: String(idx),
    dateOut: `DATE OUT mmddyy${idx}`,
    name: `NAME${idx}`,
    address: `ADDRESS street city state ZIP code${idx}`,
    phone: `TELEPHONE NUMBER${idx}`,
    sex: `BUCK  DOE  ANTLERLESS${idx}`, // double spaces are intentional
    whereKilled: `WHERE KILLED county and state or province${idx}`,
    howKilled: `HOW KILLED gun arch veh${idx}`,
    donated: `DONATED TO HUNT FOR HUNGER YN${idx}`,
    confirmation: `CONFIRMATION NUMBER${idx}`,
  };
}
