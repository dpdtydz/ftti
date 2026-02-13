import Link from 'next/link';
import { Gift, Users } from 'lucide-react';

export function ReferralCTA() {
    return (
        <div className="mb-8">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 shadow-lg text-white">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur shrink-0">
                            <Gift className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold mb-2">친구 초대하고 보상 받기 🎁</h3>
                            <p className="text-white/90 mb-4">
                                친구 1명 초대 시 프리미엄 1주일 무료! 지금 바로 시작하세요.
                            </p>
                            <div className="flex flex-wrap gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4" />
                                    <span>1명 → 1주일</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4" />
                                    <span>3명 → 1개월</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4" />
                                    <span>10명 → 3개월</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <Link
                        href="/dashboard/referral"
                        className="px-6 py-3 bg-white text-indigo-600 rounded-lg font-medium hover:bg-gray-50 transition-colors whitespace-nowrap"
                    >
                        초대하기
                    </Link>
                </div>
            </div>
        </div>
    );
}
