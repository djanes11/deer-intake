--- a/app/intake/page.tsx
+++ b/app/intake/page.tsx
@@
-export default function IntakePage() {
+// Accept searchParams so we can detect the overnight variant
+export default function IntakePage({ searchParams }: { searchParams?: Record<string,string|undefined> }) {
+  const isOvernight = (searchParams?.variant || '').toLowerCase() === 'overnight';
@@
-  // existing state for inputs...
+  // existing state for inputs...
+  // If you track status in state, default to Dropped Off when overnight
+  // const [status, setStatus] = useState(isOvernight ? 'Dropped Off' : ''); // example
@@ Tag Number input
-  <input name="tag" value={tag} onChange={...} />
+  <input
+    name="tag"
+    value={isOvernight ? '' : tag}
+    onChange={isOvernight ? undefined : onTagChange}
+    disabled={isOvernight}
+    placeholder={isOvernight ? 'Assigned by staff' : 'Tag #'}
+  />
+  {isOvernight && <div className="muted" style={{marginTop:4}}>Front desk will assign your tag in the morning.</div>}
@@ submit payload
-  const payload = { action:'save', job: { tag, customer, phone, email, ... } };
+  const payload = {
+    action:'save',
+    job: {
+      // no tag when overnight
+      tag: isOvernight ? '' : tag,
+      customer, phone, email, address, city, state, zip, county, sex, processType,
+      beefFat, webbsOrder, specialtyProducts, summerSausageLbs, summerSausageCheeseLbs, slicedJerkyLbs, notes,
+      dropoff,
+      status: isOvernight ? 'Dropped Off' : status,
+      requiresTag: !!isOvernight,
+      phoneLast4, // include if you added this input
+    }
+  };
@@ optional CSS (already mostly handled by your globals)
+/* Optional: make disabled tag look obviously read-only */
+.intake input[disabled] { opacity: .6; cursor: not-allowed; }
