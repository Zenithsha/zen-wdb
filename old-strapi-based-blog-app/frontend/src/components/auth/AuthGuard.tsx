'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface Props {
  children: React.ReactNode;
  allowedRoles?: Array<'admin' | 'blogger' | 'authenticated'>;
}

export default function AuthGuard({ children, allowedRoles }: Props) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.replace('/login');
        return;
      }
      if (allowedRoles && user.role && !allowedRoles.includes(user.role.type as 'admin' | 'blogger' | 'authenticated')) {
        router.replace('/');
      }
    }
  }, [user, isLoading, allowedRoles, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
