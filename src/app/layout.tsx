import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'GED By DZ', template: '%s — GED By DZ' },
  description: 'Des documents PDF aux formulaires réutilisables.',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
