import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // 추천 코드 생성
    const { data: codeData, error: codeError } = await supabase
      .rpc('generate_referral_code', { user_id: userId });

    if (codeError) throw codeError;

    const referralCode = codeData;

    // referrals 테이블에 저장 (pending 상태)
    const { data, error } = await supabase
      .from('referrals')
      .insert({
        referrer_id: userId,
        referral_code: referralCode,
        referred_email: '', // 아직 모름
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const referralLink = `${appUrl}?ref=${referralCode}`;

    return NextResponse.json({
      success: true,
      code: referralCode,
      link: referralLink,
      referral: data
    });
  } catch (error: any) {
    console.error('Error generating referral code:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // 사용자의 모든 추천 정보 조회
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      referrals: data
    });
  } catch (error: any) {
    console.error('Error fetching referrals:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
