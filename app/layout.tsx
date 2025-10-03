// app/layout.tsx
import './globals.css';
import Nav from './components/Nav';

export const metadata = {
  title: 'McAfee Deer Processing',
  description: 'Custom deer processing',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Mobile viewport for sane scaling */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="watermark">
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}

