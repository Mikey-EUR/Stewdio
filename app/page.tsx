import HomeClient from '@/components/home/HomeClient';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Home | Stewdio' };

export default function HomePage() {
  return <HomeClient />;
}
