'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Copy, Check, Gift, Users, TrendingUp } from 'lucide-react';

interface Referral {
  id: string;
  referral_code: string;
  referred_email: string;
  status: string;
  reward_type: string | null;
  created_at: string;
  completed_at: string | null;
}

export default function ReferralPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [referralCode, setReferralCode] = useState('');
  const [referralLink, setReferralLink] = useState('');
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    setUser(user);
    loadReferrals(user.id);
  };

  const loadReferrals = async (userId: string) => {
    try {
      const res = await fetch(`/api/referral/generate?userId=${userId}`);
      const data = await res.json();

      if (data.referrals && data.referrals.length > 0) {
        setReferrals(data.referrals);
        const mainReferral = data.referrals[0];
        setReferralCode(mainReferral.referral_code);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
        setReferralLink(`${appUrl}?ref=${mainReferral.referral_code}`);
      } else {
        // 추천 코드 생성
        await generateReferralCode(userId);
      }
    } catch (error) {
      console.error('Error loading referrals:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReferralCode = async (userId: string) => {
    try {
      const res = await fetch('/api/referral/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();
      if (data.success) {
        setReferralCode(data.code);
        setReferralLink(data.link);
        setReferrals([data.referral]);
      }
    } catch (error) {
      console.error('Error generating referral code:', error);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stats = {
    total: referrals.length,
    completed: referrals.filter((r) => r.status === 'completed' || r.status === 'rewarded')
      .length,
    pending: referrals.filter((r) => r.status === 'pending').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🎁 친구 초대하기</h1>
          <p className="text-gray-600">친구를 초대하고 프리미엄 혜택을 받으세요!</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">총 초대</p>
                <p className="text-3xl font-bold text-indigo-600">{stats.total}</p>
              </div>
              <Users className="w-12 h-12 text-indigo-600 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">가입 완료</p>
                <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <Check className="w-12 h-12 text-green-600 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">대기 중</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <TrendingUp className="w-12 h-12 text-yellow-600 opacity-20" />
            </div>
          </div>
        </div>

        {/* Referral Link */}
        <div className="bg-white rounded-xl shadow-md p-8 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">내 추천 링크</h2>

          <div className="flex gap-3">
            <input
              type="text"
              value={referralLink}
              readOnly
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
            />
            <button
              onClick={copyToClipboard}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5" />
                  복사됨!
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  복사
                </>
              )}
            </button>
          </div>

          <p className="text-sm text-gray-500 mt-4">
            💡 이 링크를 친구에게 공유하고 가입하면 자동으로 적립됩니다
          </p>
        </div>

        {/* Rewards */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl shadow-md p-8 mb-8 text-white">
          <div className="flex items-center gap-3 mb-6">
            <Gift className="w-8 h-8" />
            <h2 className="text-2xl font-bold">보상 안내</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
              <p className="text-sm opacity-80 mb-1">1명 가입</p>
              <p className="text-xl font-bold">프리미엄 1주일</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
              <p className="text-sm opacity-80 mb-1">3명 가입</p>
              <p className="text-xl font-bold">프리미엄 1개월</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
              <p className="text-sm opacity-80 mb-1">10명 가입</p>
              <p className="text-xl font-bold">프리미엄 3개월</p>
            </div>
          </div>
        </div>

        {/* Referral History */}
        <div className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">초대 내역</h2>

          {referrals.length === 0 ? (
            <p className="text-center text-gray-500 py-8">아직 초대한 친구가 없습니다</p>
          ) : (
            <div className="space-y-3">
              {referrals.map((referral) => (
                <div
                  key={referral.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {referral.referred_email || '대기 중...'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(referral.created_at).toLocaleDateString('ko-KR')}
                    </p>
                  </div>

                  <div>
                    {referral.status === 'completed' || referral.status === 'rewarded' ? (
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                        ✓ 완료
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                        ⏱ 대기 중
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
