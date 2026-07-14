import type { ReactNode } from 'react';

export const metadata = {
  title: 'tans API',
  description: 'Backend for the tans habit tracker',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
