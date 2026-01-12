'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Github } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleGithubLogin = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error('Login error:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-indigo-600">
            FTTI
          </Link>
          <p className="mt-2 text-gray-600">편하게 받아보세요</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-6">
            시작하기
          </h1>

          <div className="space-y-4">
            {/* GitHub Login */}
            <button
              onClick={handleGithubLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <Github className="w-5 h-5" />
              <span className="font-medium">
                {isLoading ? '로그인 중...' : 'GitHub로 계속하기'}
              </span>
            </button>
          </div>

          <div className="mt-6 text-center text-sm text-gray-500">
            계속 진행하면{' '}
            <Link href="/terms" className="text-indigo-600 hover:underline">
              이용약관
            </Link>
            과{' '}
            <Link href="/privacy" className="text-indigo-600 hover:underline">
              개인정보처리방침
            </Link>
            에 동의하는 것으로 간주됩니다.
          </div>
        </div>

        {/* Back to Home */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-gray-600 hover:text-gray-900 text-sm"
          >
            ← 홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
