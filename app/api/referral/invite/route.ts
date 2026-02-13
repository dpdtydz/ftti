import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 어드민 권한으로 RLS 우회
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST: 초대장 발송 (Pending 상태로 저장)
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { userId, email, referralCode } = body;

        if (!userId || !email || !referralCode) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // 1. 이미 초대했거나 가입한 유저인지 확인
        const { data: existing } = await supabase
            .from('referrals')
            .select('id, status')
            .eq('referrer_id', userId)
            .eq('referred_email', email)
            .single();

        if (existing) {
            return NextResponse.json(
                { error: 'Already invited or referred this email' },
                { status: 409 }
            );
        }

        // 2. Referrals 테이블에 pending 상태로 저장
        const { data, error } = await supabase
            .from('referrals')
            .insert({
                referrer_id: userId,
                referral_code: referralCode,
                referred_email: email,
                status: 'pending' // 대기 상태
            })
            .select()
            .single();

        if (error) throw error;

        // (선택사항) 여기서 실제 이메일 발송 로직을 추가할 수 있음
        // await sendInvitationEmail(email, referralCode);

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Error sending invitation:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}

// DELETE: 초대 취소 (Pending 상태인 경우에만 삭제)
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const referralId = searchParams.get('id');
        const userId = searchParams.get('userId');

        if (!referralId || !userId) {
            return NextResponse.json(
                { error: 'Missing referralId or userId' },
                { status: 400 }
            );
        }

        // 1. 해당 초대가 'pending' 상태이고 요청한 유저가 보낸 것인지 확인
        const { data: referral } = await supabase
            .from('referrals')
            .select('id, status, referrer_id')
            .eq('id', referralId)
            .single();

        if (!referral) {
            return NextResponse.json({ error: 'Referral not found' }, { status: 404 });
        }

        if (referral.referrer_id !== userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        if (referral.status !== 'pending') {
            return NextResponse.json({ error: 'Cannot cancel completed referral' }, { status: 400 });
        }

        // 2. 삭제 실행
        const { error } = await supabase
            .from('referrals')
            .delete()
            .eq('id', referralId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error canceling invitation:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
