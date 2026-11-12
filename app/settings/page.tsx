import SettingsClient from '@/components/settings/SettingsClient';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Settings | Stewdio' };

export default function SettingsPage() {
  return <SettingsClient />;
}
