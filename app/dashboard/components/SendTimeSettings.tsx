import { Bell, BellOff, Clock } from 'lucide-react';

interface SendTimeSettingsProps {
    isActive: boolean;
    sendTime: string;
    onToggleActive: () => void;
    onTimeChange: (newTime: string) => void;
    isLoading?: boolean;
}

export function SendTimeSettings({
    isActive,
    sendTime,
    onToggleActive,
    onTimeChange,
    isLoading = false
}: SendTimeSettingsProps) {
    return (
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
                    onClick={onToggleActive}
                    disabled={isLoading}
                    className={`relative w-12 h-6 rounded-full transition-colors ${isActive ? 'bg-indigo-600' : 'bg-gray-300'
                        } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <span
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isActive ? 'left-7' : 'left-1'
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
                        onChange={(e) => onTimeChange(e.target.value)}
                        disabled={isLoading}
                        className="px-3 py-1 border border-gray-300 rounded-lg text-gray-700 disabled:opacity-50"
                    >
                        <option value="08:00">오전 8:00 (08:00)</option>
                        <option value="10:00">오전 10:00 (10:00)</option>
                    </select>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                    📬 출근길에 읽기 좋은 시간
                </p>
            </div>
        </div>
    );
}
