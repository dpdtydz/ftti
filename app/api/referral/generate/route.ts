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

    // 1. 사용자 프로필에서 추천 코드 가져오기 (없으면 생성)
    // RPC 함수 호출 (migration에서 정의함)
    // CREATE OR REPLACE FUNCTION get_or_create_referral_code(uid UUID) ...
    const { data: code, error: rpcError } = await supabase
      .rpc('get_or_create_referral_code', { uid: userId });

    if (rpcError) {
      console.error('RPC Error:', rpcError);
      // Fallback: 직접 조회 및 생성 로직 (RPC가 없을 경우 대비)
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('referral_code')
        .eq('id', userId)
        .single();

      if (profile?.referral_code) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        return NextResponse.json({
          success: true,
          code: profile.referral_code,
          link: `${appUrl}?ref=${profile.referral_code}`,
          referral: null // 더 이상 개별 referral row를 반환하지 않음
        });
      }
      throw rpcError;
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const referralLink = `${appUrl}?ref=${code}`;

    return NextResponse.json({
      success: true,
      code: code,
      link: referralLink,
      referral: null
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
