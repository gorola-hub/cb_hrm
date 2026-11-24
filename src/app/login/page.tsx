import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex flex-col justify-center items-center p-4">
      <Suspense fallback={<div className="text-[#888888] text-sm">Loading login...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
