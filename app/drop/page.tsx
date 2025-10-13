// app/drop/page.tsx
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function Page() {
  redirect('/intake/overnight'); // your existing overnight intake page
}

