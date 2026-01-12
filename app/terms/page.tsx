import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">이용약관</h1>
        
        <div className="prose prose-gray">
          <h2 className="text-lg font-semibold mt-6 mb-3">제1조 (목적)</h2>
          <p className="text-gray-600 mb-4">
            이 약관은 FTTI(이하 "서비스")가 제공하는 뉴스레터 서비스의 이용조건 및 절차에 관한 사항을 규정함을 목적으로 합니다.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-3">제2조 (서비스 내용)</h2>
          <p className="text-gray-600 mb-4">
            서비스는 사용자가 선택한 관심사에 기반하여 개인화된 뉴스레터를 이메일로 발송합니다.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-3">제3조 (이용료)</h2>
          <p className="text-gray-600 mb-4">
            기본 서비스는 무료로 제공됩니다.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-3">제4조 (서비스 변경)</h2>
          <p className="text-gray-600 mb-4">
            서비스는 운영상 필요한 경우 서비스 내용을 변경할 수 있으며, 변경 시 사전에 공지합니다.
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
