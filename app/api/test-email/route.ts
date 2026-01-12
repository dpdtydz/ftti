import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Gemini 테스트
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: '안녕하세요! 테스트입니다. 한 문장으로 답해주세요.' }] }],
        }),
      }
    );
    const geminiData = await geminiRes.json();
    const geminiOk = !!geminiData.candidates?.[0]?.content;

    // Resend 테스트 (실제 발송 안함)
    const resendOk = !!process.env.RESEND_API_KEY;

    return NextResponse.json({
      gemini: geminiOk ? '✅ 연결됨' : '❌ 실패',
      geminiResponse: geminiData.candidates?.[0]?.content?.parts?.[0]?.text || geminiData.error,
      resend: resendOk ? '✅ API 키 있음' : '❌ API 키 없음',
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
