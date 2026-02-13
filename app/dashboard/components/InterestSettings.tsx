interface Interest {
    id: string;
    name: string;
    emoji: string;
}

interface InterestSettingsProps {
    interests: Interest[];
}

export function InterestSettings({ interests }: InterestSettingsProps) {
    return (
        <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">내 관심사</h2>
                <button className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                    수정
                </button>
            </div>
            <div className="flex flex-wrap gap-2">
                {interests.length > 0 ? (
                    interests.map((interest) => (
                        <span
                            key={interest.id}
                            className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm"
                        >
                            {interest.emoji} {interest.name}
                        </span>
                    ))
                ) : (
                    <p className="text-gray-500 text-sm">등록된 관심사가 없습니다.</p>
                )}
            </div>
        </div>
    );
}
