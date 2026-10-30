import { Outlet } from 'react-router-dom';
import { FeedbackSheet } from '@/features/feedback/FeedbackSheet';
import { ConsentGate } from '@/features/privacy/ConsentSheet';
import { BottomNav } from './BottomNav';

export function AppLayout() {
  return (
    <>
      <main className="pt-safe pb-nav mx-auto w-full max-w-lg px-4">
        <Outlet />
      </main>
      <BottomNav />
      <FeedbackSheet />
      <ConsentGate />
    </>
  );
}
