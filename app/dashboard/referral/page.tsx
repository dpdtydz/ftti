'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Copy, Check, Gift, Users, TrendingUp, Send, Trash2, Mail, Settings2 } from 'lucide-react';
import toast from 'react-hot-toast';

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
  const [confirmActions, setConfirmActions] = useState(true);

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
      // 1. 내 추천 코드 및 설정 가져오기
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('referral_code, confirm_actions')
        .eq('id', userId)
        .single();

      if (profile) {
        setReferralCode(profile.referral_code || '');
        setConfirmActions(profile.confirm_actions ?? true);
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

  const handleToggleConfirm = async () => {
    const newValue = !confirmActions;
    setConfirmActions(newValue);

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ confirm_actions: newValue })
        .eq('id', user.id);

      if (error) throw error;
      toast.success(newValue ? '확인창이 활성화되었습니다.' : '확인창이 비활성화되었습니다.');
    } catch (error) {
      toast.error('설정 저장 실패');
      setConfirmActions(!newValue);
    }
  };

  const handleCopy = () => {
    const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const shareUrl = `${appUrl}?ref=${referralCode}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('초대 링크가 복사되었습니다!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !user) return;

    if (confirmActions && !confirm(`${inviteEmail}님에게 전송하시겠습니까?`)) {
      return;
    }

    const invitePromise = (async () => {
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
      if (!res.ok) throw new Error(data.error || '초대 발송 실패');

      setInviteEmail('');
      loadReferralData(user.id);
      return data;
    })();

    toast.promise(invitePromise, {
      loading: '기록 중...',
      success: '초대장이 기록되었습니다!',
      error: (err) => err.message
    });
  };

  const handleDeleteInvite = async (referralId: string) => {
    if (confirmActions && !confirm('정말 이 초대를 취소하시겠습니까?')) {
      return;
    }

    const deletePromise = (async () => {
      const res = await fetch(`/api/referral/invite?id=${referralId}&userId=${user.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '삭제 실패');
      }

      setReferrals(prev => prev.filter(r => r.id !== referralId));
    })();

    toast.promise(deletePromise, {
      loading: '삭제 중...',
      success: '초대가 취소되었습니다.',
      error: (err) => err.message
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500 animate-pulse">로딩 중...</div>
      </div>
    );
  }

  const stats = {
    total: referrals.filter(r => r.status === 'completed' || r.status === 'rewarded').length,
    pending: referrals.filter(r => r.status === 'pending').length,
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Gift className="w-8 h-8 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">친구 초대 관리</h1>
        </div>

        {/* Toggle Setting */}
        <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-full border border-gray-200">
          <Settings2 className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">확인창 띄우기</span>
          <button
            onClick={handleToggleConfirm}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${confirmActions ? 'bg-indigo-600' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${confirmActions ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
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
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2 shrink-0"
              >
                초대 보내기
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* History Section */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-full flex flex-col min-h-[400px]">
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
