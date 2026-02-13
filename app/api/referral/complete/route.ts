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

    // 1. 추천 코드 소유자 찾기 (user_profiles에서)
    const { data: referrerProfile, error: findError } = await supabase
      .from('user_profiles')
      .select('id, email')
      .eq('referral_code', code)
      .single();

    if (findError || !referrerProfile) {
      return NextResponse.json(
        { error: 'Invalid referral code' },
        { status: 404 }
      );
    }

    const referrerId = referrerProfile.id;

    // 2. 자기 자신 추천 방지
    if (referrerId === newUserId) {
      return NextResponse.json(
        { error: 'Cannot refer yourself' },
        { status: 400 }
      );
    }

    // 3. 이미 추천받은 적이 있는지 확인 (중복 가입 방지)
    const { data: existing } = await supabase
      .from('referrals')
      .select('id')
      .eq('referred_user_id', newUserId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'User already referred' },
        { status: 400 }
      );
    }

    // 4. 새로운 추천 기록 생성 (Completed 상태로 바로 저장)
    const { data: updated, error: insertError } = await supabase
      .from('referrals')
      .insert({
        referrer_id: referrerId,
        referred_user_id: newUserId,
        referred_email: newUserEmail,
        referral_code: code,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 5. 추천인의 성공한 추천 수 확인
    const { count: successfulReferrals, error: countError } = await supabase
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', referrerId)
      .eq('status', 'completed'); // rewarded 상태도 포함해야 하나? 로직에 따라 다름. 일단 completed만으로 계산하거나 rewarded 포함.

    if (countError) throw countError;

    const totalCount = successfulReferrals || 0;

    // 보상 결정
    let rewardType = null;
    // 단순화된 보상 로직: 1, 3, 10명째에만 보상 지급? 아니면 누적?
    // 기존 로직 유지: 달성 시점마다 업데이트
    if (totalCount === 10) {
      rewardType = 'premium_3months';
    } else if (totalCount === 3) {
      rewardType = 'premium_month';
    } else if (totalCount === 1) {
      rewardType = 'premium_week';
    }

    // 보상이 있다면 해당 건에 기록 (마지막 건에 기록하여 중복 지급 방지)
    if (rewardType) {
      await supabase
        .from('referrals')
        .update({
          reward_type: rewardType,
          status: 'rewarded', // 상태 변경
          reward_claimed_at: new Date().toISOString()
        })
        .eq('id', updated.id);
    }

    return NextResponse.json({
      success: true,
      referral: updated,
      totalSuccessfulReferrals: totalCount,
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
