// app/layout.tsx
import './globals.css';
import Nav from './components/Nav';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div id="camo-bg" aria-hidden />
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}


