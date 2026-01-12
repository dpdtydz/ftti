'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, Calendar, Settings, LogOut, Bell, BellOff, Clock, Sparkles } from 'lucide-react';

const mockInterests = [
  { id: 'tech', name: '기술/IT', emoji: '💻' },
  { id: 'business', name: '비즈니스', emoji: '💼' },
  { id: 'health', name: '건강', emoji: '🏃' },
];

const mockNewsletters = [
  {
    id: 1,
    date: '2024-01-12',
    title: '오늘의 테크 뉴스',
    preview: 'OpenAI, 새로운 GPT-5 발표 임박...',
    interests: ['기술/IT'],
  },
  {
    id: 2,
    date: '2024-01-11',
    title: '비즈니스 트렌드',
    preview: '2024년 스타트업 투자 동향...',
    interests: ['비즈니스'],
  },
  {
    id: 3,
    date: '2024-01-10',
    title: '건강 팁',
    preview: '겨울철 면역력 높이는 방법...',
    interests: ['건강'],
  },
];

export default function DashboardPage() {
  const [isActive, setIsActive] = useState(true);
  const [sendTime, setSendTime] = useState('07:00');

  // Mock user data
  const user = {
    name: '이호상',
    email: 'user@example.com',
    joinedDays: 7,
    receivedCount: 5,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-indigo-600">
            FTTI
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">{user.name}님</span>
            <button className="text-gray-500 hover:text-gray-700">
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
                <p className="text-3xl font-bold text-gray-900">{user.receivedCount}</p>
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
                <p className="text-3xl font-bold text-gray-900">{user.joinedDays}일</p>
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
                <p className="text-3xl font-bold text-gray-900">{mockInterests.length}개</p>
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
                <button className="text-indigo-600 text-sm hover:underline">
                  수정
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {mockInterests.map((interest) => (
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
                  onClick={() => setIsActive(!isActive)}
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
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-gray-500" />
                  <span className="text-gray-700">발송 시간</span>
                </div>
                <select
                  value={sendTime}
                  onChange={(e) => setSendTime(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-gray-700"
                >
                  <option value="07:00">오전 7:00</option>
                  <option value="08:00">오전 8:00</option>
                  <option value="09:00">오전 9:00</option>
                  <option value="10:00">오전 10:00</option>
                </select>
              </div>
            </div>
          </div>

          {/* Right Column - Recent Newsletters */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  최근 받은 뉴스레터
                </h2>
                <Link
                  href="/archive"
                  className="text-indigo-600 text-sm hover:underline"
                >
                  전체 보기
                </Link>
              </div>

              <div className="space-y-4">
                {mockNewsletters.map((newsletter) => (
                  <div
                    key={newsletter.id}
                    className="p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {newsletter.title}
                        </h3>
                        <p className="text-gray-500 text-sm mt-1">
                          {newsletter.preview}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          {newsletter.interests.map((interest) => (
                            <span
                              key={interest}
                              className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                            >
                              {interest}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="text-sm text-gray-400">
                        {newsletter.date}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {mockNewsletters.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>아직 받은 뉴스레터가 없어요</p>
                  <p className="text-sm">내일 아침부터 받아보세요!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
