'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';

import { StatsCards } from './components/StatsCards';
import { ReferralCTA } from './components/ReferralCTA';
import { InterestSettings } from './components/InterestSettings';
import { SendTimeSettings } from './components/SendTimeSettings';
import { NewsletterHistory } from './components/NewsletterHistory';

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
  const [stats, setStats] = useState({
    newsletterCount: 0,
    daysJoined: 0,
    interestCount: 0
  });

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

      // Time Validation
      const currentTime = profileData.send_time?.slice(0, 5) || '08:00';
      const validTime = ['08:00', '10:00'].includes(currentTime) ? currentTime : '08:00';
      setSendTime(validTime);

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

      const formattedInterests = userInterests
        ? userInterests.map((ui: any) => ui.interests)
        : [];
      setInterests(formattedInterests);

      // Load Stats
      // 1. Newsletter Count
      const { count: newsletterCount } = await supabase
        .from('newsletter_sends')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'sent');

      setStats({
        newsletterCount: newsletterCount || 0,
        daysJoined: profileData.created_at
          ? Math.floor((Date.now() - new Date(profileData.created_at).getTime()) / (1000 * 60 * 60 * 24)) + 1
          : 1,
        interestCount: formattedInterests.length
      });

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
      .update({
        send_time: newTime + ':00',
        preferred_send_time: newTime // Sync preferred time
      })
      .eq('id', user.id);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
            FTTI
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-gray-600 hidden md:block">{profile?.nickname || user?.email}님</span>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-full transition-colors"
              title="로그아웃"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <StatsCards
          newsletterCount={stats.newsletterCount}
          daysJoined={stats.daysJoined}
          interestCount={stats.interestCount}
        />

        <ReferralCTA />

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Settings */}
          <div className="lg:col-span-1 space-y-6">
            <InterestSettings interests={interests} />
            <SendTimeSettings
              isActive={isActive}
              sendTime={sendTime}
              onToggleActive={handleToggleActive}
              onTimeChange={handleTimeChange}
              isLoading={isLoading}
            />
          </div>

          {/* Right Column - Newsletter History */}
          <div className="lg:col-span-2">
            <NewsletterHistory userId={user?.id} />
          </div>
        </div>
      </main>
    </div>
  );
}

