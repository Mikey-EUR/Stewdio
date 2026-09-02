import GroceriesClient from '@/components/groceries/GroceriesClient';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Groceries | Stewdio' };

export default function GroceriesPage() {
  return <GroceriesClient />;
}
