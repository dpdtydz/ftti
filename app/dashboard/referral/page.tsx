'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Copy, Check, Gift, Users, TrendingUp, Send, Trash2, Mail } from 'lucide-react';

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
  const [inviteEmail, setInviteEmail] = useState('');
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

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
    loadReferralData(user.id);
  };

  const loadReferralData = async (userId: string) => {
    try {
      // 1. 내 추천 코드 가져오기 (프로필에서)
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('referral_code')
        .eq('id', userId)
        .single();

      if (profile?.referral_code) {
        setReferralCode(profile.referral_code);
      } else {
        // 코드가 없으면 생성 요청 (예외 처리용)
        const res = await fetch('/api/referral/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        const data = await res.json();
        if (data.referralCode) setReferralCode(data.referralCode);
      }

      // 2. 추천 현황 가져오기
      const { data: referralList, error } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReferrals(referralList || []);
    } catch (error) {
      console.error('Error loading referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const shareUrl = `${appUrl}?ref=${referralCode}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !user) return;

    setSending(true);
    try {
      const res = await fetch('/api/referral/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: inviteEmail,
          referralCode: referralCode
        })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || '초대 발송 실패');
        return;
      }

      alert('초대장이 기록되었습니다!');
      setInviteEmail('');
      loadReferralData(user.id); // 목록 갱신
    } catch (error) {
      console.error('Invite error:', error);
      alert('오류가 발생했습니다.');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteInvite = async (referralId: string) => {
    if (!confirm('정말 이 초대를 취소하시겠습니까?')) return;

    try {
      const res = await fetch(`/api/referral/invite?id=${referralId}&userId=${user.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || '삭제 실패');
        return;
      }

      // 목록 갱신
      setReferrals(prev => prev.filter(r => r.id !== referralId));
    } catch (error) {
      console.error('Delete error:', error);
      alert('오류가 발생했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  const stats = {
    total: referrals.filter(r => r.status === 'completed' || r.status === 'rewarded').length,
    pending: referrals.filter(r => r.status === 'pending').length,
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-8">
        <Gift className="w-8 h-8 text-indigo-600" />
        <h1 className="text-2xl font-bold text-gray-900">친구 초대하고 혜택 받기</h1>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">초대 완료</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}명</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">대기 중</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pending}명</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-lg">
              <Gift className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">획득 보상</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}건</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-6">
          {/* Invite Section */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Copy className="w-5 h-5 text-indigo-600" /> 내 초대 링크
            </h2>
            <div className="flex gap-2">
              <div className="flex-1 bg-gray-50 px-4 py-3 rounded-lg border border-gray-200 text-gray-600 font-mono text-sm truncate">
                {typeof window !== 'undefined' ? `${window.location.origin}?ref=${referralCode}` : `?ref=${referralCode}`}
              </div>
              <button
                onClick={handleCopy}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 shrink-0"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? '복사됨' : '링크 복사'}
              </button>
            </div>
          </div>

          {/* Email Invite Form */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-600" /> 이메일로 초대하기
            </h2>
            <form onSubmit={handleSendInvite} className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="친구의 이메일 주소를 입력하세요"
                className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                required
              />
              <button
                type="submit"
                disabled={sending}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2 shrink-0"
              >
                {sending ? '기록 중...' : '초대 보내기'}
                {!sending && <Send className="w-4 h-4" />}
              </button>
            </form>
            <p className="mt-3 text-xs text-gray-500">
              * 초대장을 보내면 친구가 가입할 때까지 대기 목록에 표시됩니다.
            </p>
          </div>
        </div>

        {/* History Section */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-full flex flex-col">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold">초대 현황</h2>
            </div>

            <div className="flex-1 overflow-y-auto">
              {referrals.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  아직 초대한 친구가 없습니다.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {referrals.map((referral) => (
                    <div key={referral.id} className="p-4 flex items-center justify-between hover:bg-gray-50 group">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${referral.status === 'completed' || referral.status === 'rewarded' ? 'bg-green-500' :
                            referral.status === 'pending' ? 'bg-yellow-500' : 'bg-gray-300'
                          }`} />
                        <div>
                          <p className="font-medium text-gray-900 text-sm truncate max-w-[120px]">
                            {referral.referred_email}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {new Date(referral.created_at).toLocaleDateString()} •
                            {referral.status === 'completed' || referral.status === 'rewarded' ? ' 완료' : ' 대기'}
                          </p>
                        </div>
                      </div>

                      {referral.status === 'pending' && (
                        <button
                          onClick={() => handleDeleteInvite(referral.id)}
                          className="text-gray-400 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                          title="초대 취소"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
