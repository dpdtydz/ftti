import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Gemini 테스트
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
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

    // Brevo 테스트
    const brevoOk = !!process.env.BREVO_API_KEY;

    return NextResponse.json({
      gemini: geminiOk ? '✅ 연결됨' : '❌ 실패',
      geminiResponse: geminiData.candidates?.[0]?.content?.parts?.[0]?.text || geminiData.error,
      brevo: brevoOk ? '✅ API 키 있음' : '❌ API 키 없음',
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
