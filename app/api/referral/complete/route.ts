import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { code, newUserId, newUserEmail } = await req.json();

    if (!code || !newUserId || !newUserEmail) {
      return NextResponse.json(
        { error: 'code, newUserId, and newUserEmail are required' },
        { status: 400 }
      );
    }

    // 추천 코드 찾기
    const { data: referral, error: findError } = await supabase
      .from('referrals')
      .select('*')
      .eq('referral_code', code)
      .eq('status', 'pending')
      .single();

    if (findError || !referral) {
      return NextResponse.json(
        { error: 'Invalid or already used referral code' },
        { status: 404 }
      );
    }

    // 추천 완료 처리
    const { data: updated, error: updateError } = await supabase
      .from('referrals')
      .update({
        referred_email: newUserEmail,
        referred_user_id: newUserId,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', referral.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 추천인의 성공한 추천 수 확인
    const { data: referrals, error: countError } = await supabase
      .from('referrals')
      .select('id')
      .eq('referrer_id', referral.referrer_id)
      .eq('status', 'completed');

    if (countError) throw countError;

    const successfulReferrals = referrals?.length || 0;

    // 보상 결정
    let rewardType = null;
    if (successfulReferrals >= 10) {
      rewardType = 'premium_3months';
    } else if (successfulReferrals >= 3) {
      rewardType = 'premium_month';
    } else if (successfulReferrals >= 1) {
      rewardType = 'premium_week';
    }

    // 보상이 있다면 업데이트
    if (rewardType) {
      await supabase
        .from('referrals')
        .update({
          reward_type: rewardType,
          status: 'rewarded',
          reward_claimed_at: new Date().toISOString()
        })
        .eq('id', referral.id);
    }

    return NextResponse.json({
      success: true,
      referral: updated,
      totalSuccessfulReferrals: successfulReferrals,
      rewardEarned: rewardType
    });
  } catch (error: any) {
    console.error('Error completing referral:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
