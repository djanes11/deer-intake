import 'server-only';
import Link from 'next/link';
import Image from 'next/image';

type NavLink = { href: string; label: string };

const NAV: readonly NavLink[] = [
  { href: '/', label: 'Home' },
  { href: '/status', label: 'Check Status' },
  { href: '/drop-instructions', label: 'Overnight Drop' },
  { href: '/faq-public', label: 'FAQ' },
  { href: '/hours', label: 'Hours' },
  { href: '/contact', label: 'Contact' },
];

export default function CustomerHeader() {
  return (
    <header style={{
      borderBottom: '1px solid #E5E7EB',
      background: '#0b0f12',
      color: '#E5E7EB'
    }}>
      <div style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 16
      }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:44, height:44 }}>
            <Image src="/crest.png" alt="McAfee Crest" width={44} height={44} priority />
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#E5E7EB' }}>McAfee Custom Deer Processing</span>
        </Link>

        <nav style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center', flexWrap:'wrap' }}>
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid #334155',
                color: '#E5E7EB',
                textDecoration: 'none'
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
