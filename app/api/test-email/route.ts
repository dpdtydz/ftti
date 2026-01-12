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
          contents: [{ parts: [{ text: '안녕' }] }],
        }),
      }
    );
    const geminiData = await geminiRes.json();
    const geminiOk = !!geminiData.candidates?.[0]?.content;

    // Brevo 테스트 - 실제 API 호출
    const brevoRes = await fetch('https://api.brevo.com/v3/account', {
      headers: {
        'api-key': process.env.BREVO_API_KEY || '',
      },
    });
    const brevoData = await brevoRes.json();
    const brevoOk = brevoRes.ok;

    // Naver 테스트
    const naverRes = await fetch(
      `https://openapi.naver.com/v1/search/news.json?query=IT&display=1`,
      {
        headers: {
          'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID || '',
          'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET || '',
        },
      }
    );
    const naverData = await naverRes.json();
    const naverOk = naverRes.ok;

    return NextResponse.json({
      gemini: geminiOk ? '✅ 연결됨' : '❌ 실패',
      brevo: brevoOk ? '✅ 연결됨' : '❌ 실패',
      brevoError: brevoOk ? null : brevoData,
      naver: naverOk ? '✅ 연결됨' : '❌ 실패',
      naverError: naverOk ? null : naverData,
      envCheck: {
        BREVO_API_KEY: process.env.BREVO_API_KEY ? '✅ 있음 (' + process.env.BREVO_API_KEY.substring(0, 10) + '...)' : '❌ 없음',
        NAVER_CLIENT_ID: process.env.NAVER_CLIENT_ID ? '✅ 있음' : '❌ 없음',
      }
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
