# Twin Turbo label printing

Staff intake (desktop and mobile actions), search, and overnight review now offer Meat Tag, plus Antler Tag and Meat + Antler for the existing eligible processing types. Eligibility remains Caped, Cape & Donate, Skull-Cap, and European; sex alone does not enable an antler label.

Meat artwork is 2 inches wide by 1 inch tall, with customer name, tag number, and phone only. Antler artwork is 59 mm wide by 102 mm tall, portrait, with processing selection and a separate bottom barcode strip. The direct-print antler design is text-based; the browser antler design retains its existing logo. Direct barcode artwork uses integer-width CODE128 bars and quiet zones at 300 dpi.

## One-time setup on the shop computer

1. Install DYMO Connect and the Twin Turbo driver from DYMO, connect the printer, and confirm it works in DYMO's software. Keep its local web service running. Allow browser access to the local service when prompted.
2. In the web app open **Label printer setup** and choose **Find Twin Turbo**. Choose the printer and which roll holds the meat labels. The opposite roll is reserved for antler labels; the app never requests automatic roll selection.
3. Download each sample artwork image from setup. In DYMO Connect, select the actual matching stock, orientation, and margins. Insert the appropriate sample image into a blank label, name the image object **ARTWORK** in its properties, and size it proportionally within the printable area. The template must contain exactly that one image object. Save each as a `.dymo` or `.label` file and load it into setup. This preserves the driver's actual stock definition rather than guessing a product number from approximate dimensions.
4. Use the two test-print buttons. Verify the correct roll, readable full name/tag/phone, label feed, and large-tag barcode scanning. Inspect the bottom strip before cutting it. Adjust the DYMO template if necessary and reload it.
5. Save printer setup. It is stored only in that browser's local storage, shared across processors on that workstation. Other computers and browser profiles need their own setup. Clearing site data removes it. Templates should contain sample artwork, not real customer information.

After setup, staff print directly from the web app. **Meat + Antler (DYMO)** sends one job per roll. Individual buttons reprint just that tag. If the printer selection is cleared and saved, individual buttons use the browser print dialog; combined printing requires DYMO setup.

## Reliability and limits

- Direct prints load the saved job; staff intake saves dirty changes first. Eligibility is checked again against the saved record.
- Both templates are validated/rendered by DYMO before either job is sent. A failed second preflight therefore cannot leave a lone meat tag.
- A submission error never retries automatically. If the second submission fails, the message identifies that the first was sent and asks staff to inspect the printer before reprinting. A timeout can occur after the printer accepted a job.
- The two rolls are separate jobs, not an atomic physical operation. An accepted job does not prove the label printed, and empty rolls/jams still need operator attention.
- A page-wide lock prevents overlapping submissions from this page's duplicate desktop/mobile controls. Separate tabs/workstations are independent.
- No database migration, payment update, intake print-count update, or customer notification is performed by label printing.
- Application tests cover explicit roll selection, disconnected printers, preflight ordering, and partial/uncertain submission errors. A physical Twin Turbo test remains required before seasonal use; no physical printer was available in development.

Official SDK: https://github.com/dymosoftware/dymo-connect-framework
