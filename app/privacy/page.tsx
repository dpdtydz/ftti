import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">개인정보처리방침</h1>
        
        <div className="prose prose-gray">
          <h2 className="text-lg font-semibold mt-6 mb-3">1. 수집하는 개인정보</h2>
          <p className="text-gray-600 mb-4">
            서비스는 다음의 개인정보를 수집합니다:
          </p>
          <ul className="list-disc list-inside text-gray-600 mb-4">
            <li>이메일 주소 (뉴스레터 발송용)</li>
            <li>관심사 정보 (개인화 서비스 제공용)</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6 mb-3">2. 개인정보 이용 목적</h2>
          <p className="text-gray-600 mb-4">
            수집된 개인정보는 뉴스레터 발송 및 서비스 개선을 위해서만 사용됩니다.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-3">3. 개인정보 보유 기간</h2>
          <p className="text-gray-600 mb-4">
            회원 탈퇴 시 즉시 파기됩니다.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-3">4. 제3자 제공</h2>
          <p className="text-gray-600 mb-4">
            수집된 개인정보는 제3자에게 제공되지 않습니다.
          </p>
        </div>

        <div className="mt-8 pt-6 border-t">
          <Link href="/login" className="text-indigo-600 hover:underline">
            ← 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
