'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, Sparkles, Clock, Gift, ChevronDown, ChevronUp } from 'lucide-react';

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const features = [
    {
      icon: Sparkles,
      title: '개인화 큐레이션',
      description: 'AI가 관심사를 분석해 딱 맞는 정보만 골라드려요',
    },
    {
      icon: Mail,
      title: '매일 자동 발송',
      description: '매일 아침 설정한 시간에 이메일로 받아보세요',
    },
    {
      icon: Clock,
      title: '시간 절약',
      description: '정보 찾는 시간을 줄이고 중요한 일에 집중하세요',
    },
    {
      icon: Gift,
      title: '완전 무료',
      description: '기본 기능은 무료로 이용할 수 있어요',
    },
  ];

  const steps = [
    { number: '1', title: '관심사 선택', description: '기술, 비즈니스, 건강 등 원하는 분야를 선택하세요' },
    { number: '2', title: 'AI가 정보 수집', description: '매일 밤 AI가 최신 정보를 수집하고 정리해요' },
    { number: '3', title: '아침 이메일 발송', description: '설정한 시간에 맞춤 뉴스레터가 도착해요' },
  ];

  const faqs = [
    {
      question: '정말 무료인가요?',
      answer: '네! 관심사 3개까지는 완전 무료입니다. 더 많은 관심사나 추가 기능은 프리미엄에서 이용하실 수 있어요.',
    },
    {
      question: '어떤 정보를 받을 수 있나요?',
      answer: '기술/IT, 비즈니스, 건강, 스포츠, 엔터테인먼트, 경제, 자기계발 등 다양한 분야의 최신 정보를 받아보실 수 있어요.',
    },
    {
      question: '발송 시간을 바꿀 수 있나요?',
      answer: '물론이죠! 대시보드에서 원하는 시간으로 언제든 변경할 수 있어요.',
    },
    {
      question: '구독을 취소하고 싶으면요?',
      answer: '설정에서 언제든 구독을 중단하거나 계정을 삭제할 수 있어요. 복잡한 절차 없어요!',
    },
    {
      question: '개인정보는 안전한가요?',
      answer: '이메일 주소와 관심사 정보만 수집하며, 제3자에게 절대 공유하지 않아요.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="text-2xl font-bold text-indigo-600">FTTI</div>
          <Link
            href="/login"
            className="px-4 py-2 text-indigo-600 hover:text-indigo-700 font-medium"
          >
            로그인
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
          매일 아침,<br />
          <span className="text-indigo-600">나만을 위한 정보</span>가<br />
          메일함으로
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          AI가 관심사에 맞는 최신 정보를 큐레이션해서 보내드려요.
          <br />
          정보 탐색 시간을 줄이고, 편하게 받아보세요.
        </p>
        <Link
          href="/login"
          className="inline-block px-8 py-4 bg-indigo-600 text-white text-lg font-semibold rounded-full hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-xl"
        >
          무료로 시작하기
        </Link>
        <p className="mt-4 text-sm text-gray-500">
          가입 후 바로 사용 가능 • 신용카드 필요 없음
        </p>
      </section>

      {/* How it Works */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          어떻게 작동하나요?
        </h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map((step, index) => (
            <div key={index} className="text-center">
              <div className="w-16 h-16 bg-indigo-600 text-white text-2xl font-bold rounded-full flex items-center justify-center mx-auto mb-4">
                {step.number}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{step.title}</h3>
              <p className="text-gray-600">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            왜 FTTI인가요?
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <div
                key={index}
                className="p-6 rounded-2xl bg-gray-50 hover:bg-indigo-50 transition-colors"
              >
                <feature.icon className="w-12 h-12 text-indigo-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          자주 묻는 질문
        </h2>
        <div className="max-w-2xl mx-auto space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              <button
                className="w-full px-6 py-4 text-left flex items-center justify-between bg-white hover:bg-gray-50"
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
              >
                <span className="font-medium text-gray-900">{faq.question}</span>
                {openFaq === index ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </button>
              {openFaq === index && (
                <div className="px-6 py-4 bg-gray-50 text-gray-600">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-indigo-600 py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            지금 바로 시작하세요
          </h2>
          <p className="text-indigo-100 mb-8">
            내일 아침부터 맞춤 정보를 받아볼 수 있어요
          </p>
          <Link
            href="/login"
            className="inline-block px-8 py-4 bg-white text-indigo-600 text-lg font-semibold rounded-full hover:bg-gray-100 transition-colors"
          >
            무료로 시작하기
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="text-2xl font-bold text-white mb-4 md:mb-0">FTTI</div>
            <div className="flex space-x-6 text-sm">
              <Link href="/terms" className="hover:text-white">이용약관</Link>
              <Link href="/privacy" className="hover:text-white">개인정보처리방침</Link>
              <Link href="/contact" className="hover:text-white">문의하기</Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm">
            © 2024 FTTI. Feel free to take it.
          </div>
        </div>
      </footer>
    </div>
  );
}
