'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session error:', error);
          router.push('/login');
          return;
        }

        if (session?.user) {
          // Check if user profile exists
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('id', session.user.id)
            .single();

          if (!profile) {
            // New user - go to onboarding
            router.push('/onboarding');
          } else {
            // Existing user - go to dashboard
            router.push('/dashboard');
          }
        } else {
          router.push('/login');
        }
      } catch (err) {
        console.error('Callback error:', err);
        router.push('/login');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">로그인 처리 중...</p>
      </div>
    </div>
  );
}
