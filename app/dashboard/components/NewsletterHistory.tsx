import { Mail, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface NewsletterSend {
    id: string;
    subject: string;
    sent_at: string;
    status: string;
    opened_at: string | null;
    clicked_at: string | null;
}

interface NewsletterHistoryProps {
    userId: string;
}

export function NewsletterHistory({ userId }: NewsletterHistoryProps) {
    const [newsletters, setNewsletters] = useState<NewsletterSend[]>([]);
    const [loading, setLoading] = useState(true);

    const handleViewAll = () => {
        toast('전체 내역 보기 기능은 준비 중입니다.', { icon: 'ℹ️' });
    };

    useEffect(() => {
        if (userId) {
            loadHistory();
        }
    }, [userId]);

    const loadHistory = async () => {
        try {
            const { data, error } = await supabase
                .from('newsletter_sends')
                .select('*')
                .eq('user_id', userId)
                .order('sent_at', { ascending: false })
                .limit(5);

            if (error) throw error;
            setNewsletters(data || []);
        } catch (error) {
            console.error('Error loading newsletter history:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-xl p-6 shadow-sm h-full">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">
                    최근 받은 뉴스레터
                </h2>
                {newsletters.length > 0 && (
                    <button className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                        전체보기 <ArrowRight className="w-4 h-4" />
                    </button>
                )}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12 text-gray-400">
                    로딩 중...
                </div>
            ) : newsletters.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                    <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>아직 받은 뉴스레터가 없어요</p>
                    <p className="text-sm">내일 아침부터 받아보세요!</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {newsletters.map((newsletter) => (
                        <div
                            key={newsletter.id}
                            className="group flex items-start gap-4 p-4 rounded-lg border border-gray-100 hover:border-indigo-100 hover:bg-indigo-50 transition-all cursor-pointer"
                        >
                            <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${newsletter.clicked_at ? 'bg-green-500' :
                                newsletter.opened_at ? 'bg-blue-500' : 'bg-gray-300'
                                }`} />
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-medium text-gray-900 truncate pr-4">
                                    {newsletter.subject}
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">
                                    {new Date(newsletter.sent_at).toLocaleDateString('ko-KR', {
                                        month: 'long',
                                        day: 'numeric',
                                        weekday: 'long'
                                    })}
                                    {' • '}
                                    {newsletter.opened_at ? '읽음' : '전송됨'}
                                </p>
                            </div>
                            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 self-center" />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
