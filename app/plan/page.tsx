import PlanClient from '@/components/plan/PlanClient';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Plan | Stewdio' };

export default function PlanPage() {
  return <PlanClient />;
}
