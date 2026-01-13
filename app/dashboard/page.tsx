'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Calendar, LogOut, Bell, BellOff, Clock, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Interest {
  id: string;
  name: string;
  emoji: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [isActive, setIsActive] = useState(true);
  const [sendTime, setSendTime] = useState('08:00');
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }
      
      setUser(user);

      // Load profile
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!profileData) {
        router.push('/onboarding');
        return;
      }

      setProfile(profileData);
      setIsActive(profileData.is_active);
      
      // 기존 시간이 07:00 또는 10:00이면 08:00으로 변경
      const currentTime = profileData.send_time?.slice(0, 5) || '08:00';
      const validTime = ['08:00', '09:00'].includes(currentTime) ? currentTime : '08:00';
      setSendTime(validTime);
      
      // DB도 업데이트
      if (currentTime !== validTime) {
        await supabase
          .from('user_profiles')
          .update({ send_time: validTime + ':00' })
          .eq('id', user.id);
      }

      // Load user interests
      const { data: userInterests } = await supabase
        .from('user_interests')
        .select('interest_id, interests(id, name, emoji)')
        .eq('user_id', user.id);

      if (userInterests) {
        const formattedInterests = userInterests.map((ui: any) => ui.interests);
        setInterests(formattedInterests);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async () => {
    const newValue = !isActive;
    setIsActive(newValue);
    
    await supabase
      .from('user_profiles')
      .update({ is_active: newValue })
      .eq('id', user.id);
  };

  const handleTimeChange = async (newTime: string) => {
    setSendTime(newTime);
    
    await supabase
      .from('user_profiles')
      .update({ send_time: newTime + ':00' })
      .eq('id', user.id);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  const joinedDays = profile?.created_at 
    ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 1;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-indigo-600">
            FTTI
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">{profile?.nickname || user?.email}님</span>
            <button 
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-700"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                <Mail className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">0</p>
                <p className="text-gray-500">받은 뉴스레터</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">{joinedDays}일</p>
                <p className="text-gray-500">가입 후 경과</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">{interests.length}개</p>
                <p className="text-gray-500">관심사</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Settings */}
          <div className="lg:col-span-1 space-y-6">
            {/* Interests */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">내 관심사</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {interests.map((interest) => (
                  <span
                    key={interest.id}
                    className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm"
                  >
                    {interest.emoji} {interest.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Send Settings */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                발송 설정
              </h2>

              {/* Active Toggle */}
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  {isActive ? (
                    <Bell className="w-5 h-5 text-indigo-600" />
                  ) : (
                    <BellOff className="w-5 h-5 text-gray-400" />
                  )}
                  <span className="text-gray-700">뉴스레터 받기</span>
                </div>
                <button
                  onClick={handleToggleActive}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    isActive ? 'bg-indigo-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      isActive ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {/* Time Setting */}
              <div className="py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-gray-500" />
                    <span className="text-gray-700">발송 시간</span>
                  </div>
                  <select
                    value={sendTime}
                    onChange={(e) => handleTimeChange(e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-gray-700"
                  >
                    <option value="08:00">오후 5:00 (17:00)</option>
                    <option value="09:00">오후 6:00 (18:00)</option>
                  </select>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  🌏 한국 시간 기준 (KST)
                </p>
              </div>
            </div>
          </div>

          {/* Right Column - Recent Newsletters */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">
                최근 받은 뉴스레터
              </h2>

              <div className="text-center py-12 text-gray-500">
                <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>아직 받은 뉴스레터가 없어요</p>
                <p className="text-sm">내일부터 받아보세요!</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
