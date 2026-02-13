import { Mail, Calendar, Sparkles } from 'lucide-react';

interface StatsCardsProps {
    newsletterCount: number;
    daysJoined: number;
    interestCount: number;
}

export function StatsCards({ newsletterCount, daysJoined, interestCount }: StatsCardsProps) {
    return (
        <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                        <Mail className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-gray-900">{newsletterCount}</p>
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
                        <p className="text-3xl font-bold text-gray-900">{daysJoined}일</p>
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
                        <p className="text-3xl font-bold text-gray-900">{interestCount}개</p>
                        <p className="text-gray-500">관심사</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
