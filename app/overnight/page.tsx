import 'server-only';
import { redirect } from 'next/navigation';

export default function OvernightRedirectPage() {
  redirect('/intake/overnight');
}
