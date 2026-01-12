'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';

const interests = [
  { id: 'tech', name: '기술/IT', emoji: '💻' },
  { id: 'business', name: '비즈니스', emoji: '💼' },
  { id: 'health', name: '건강', emoji: '🏃' },
  { id: 'sports', name: '스포츠', emoji: '⚽' },
  { id: 'entertainment', name: '엔터테인먼트', emoji: '🎬' },
  { id: 'economy', name: '경제', emoji: '📈' },
  { id: 'self-development', name: '자기계발', emoji: '📚' },
  { id: 'food', name: '음식/요리', emoji: '🍳' },
  { id: 'travel', name: '여행', emoji: '✈️' },
  { id: 'science', name: '과학', emoji: '🔬' },
];

const times = ['07:00', '08:00', '09:00', '10:00'];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState('07:00');

  const toggleInterest = (id: string) => {
    setSelectedInterests((prev) =>
      prev.includes(id)
        ? prev.filter((i) => i !== id)
        : prev.length < 3
        ? [...prev, id]
        : prev
    );
  };

  const handleNext = () => {
    if (step === 1 && selectedInterests.length > 0) {
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleComplete = async () => {
    // TODO: Save to Supabase
    console.log('Interests:', selectedInterests);
    console.log('Time:', selectedTime);
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`w-3 h-3 rounded-full transition-colors ${
                s <= step ? 'bg-indigo-600' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Step 1: Interest Selection */}
          {step === 1 && (
            <>
              <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
                관심사를 선택해주세요
              </h1>
              <p className="text-gray-600 text-center mb-6">
                최대 3개까지 선택할 수 있어요 (무료 플랜)
              </p>

              <div className="grid grid-cols-2 gap-3 mb-8">
                {interests.map((interest) => (
                  <button
                    key={interest.id}
                    onClick={() => toggleInterest(interest.id)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      selectedInterests.includes(interest.id)
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-2xl">{interest.emoji}</span>
                    <p className="mt-1 font-medium text-gray-900">
                      {interest.name}
                    </p>
                    {selectedInterests.includes(interest.id) && (
                      <Check className="absolute top-2 right-2 w-5 h-5 text-indigo-600" />
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={handleNext}
                disabled={selectedInterests.length === 0}
                className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                다음 ({selectedInterests.length}/3 선택됨)
              </button>
            </>
          )}

          {/* Step 2: Time Selection */}
          {step === 2 && (
            <>
              <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
                발송 시간을 선택해주세요
              </h1>
              <p className="text-gray-600 text-center mb-6">
                매일 이 시간에 뉴스레터를 보내드려요
              </p>

              <div className="grid grid-cols-2 gap-3 mb-8">
                {times.map((time) => (
                  <button
                    key={time}
                    onClick={() => setSelectedTime(time)}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      selectedTime === time
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="text-2xl font-bold text-gray-900">{time}</p>
                    <p className="text-sm text-gray-500">오전</p>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  이전
                </button>
                <button
                  onClick={handleNext}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                >
                  다음
                </button>
              </div>
            </>
          )}

          {/* Step 3: Complete */}
          {step === 3 && (
            <>
              <div className="text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Check className="w-10 h-10 text-green-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  설정 완료!
                </h1>
                <p className="text-gray-600 mb-8">
                  내일 아침 {selectedTime}부터<br />
                  맞춤 뉴스레터를 받아보세요 🎉
                </p>

                <div className="bg-gray-50 rounded-xl p-4 mb-8 text-left">
                  <p className="text-sm text-gray-500 mb-2">선택한 관심사</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedInterests.map((id) => {
                      const interest = interests.find((i) => i.id === id);
                      return (
                        <span
                          key={id}
                          className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm"
                        >
                          {interest?.emoji} {interest?.name}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={handleComplete}
                  className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                >
                  대시보드로 이동
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
