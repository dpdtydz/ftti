export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            user_profiles: {
                Row: {
                    id: string
                    email: string | null
                    nickname: string | null
                    is_active: boolean
                    send_time: string | null
                    preferred_send_time: string | null
                    created_at: string
                    referral_code: string | null // New column
                }
                Insert: {
                    id: string
                    email?: string | null
                    nickname?: string | null
                    is_active?: boolean
                    send_time?: string | null
                    preferred_send_time?: string | null
                    created_at?: string
                    referral_code?: string | null
                }
                Update: {
                    id?: string
                    email?: string | null
                    nickname?: string | null
                    is_active?: boolean
                    send_time?: string | null
                    preferred_send_time?: string | null
                    created_at?: string
                    referral_code?: string | null
                }
            }
            newsletter_sends: {
                Row: {
                    id: string
                    user_id: string
                    subject: string
                    content: Json
                    sent_at: string
                    status: string
                    trust_score: number | null
                    engines_used: string[] | null
                    processing_time: number | null
                    opened_at: string | null
                    clicked_at: string | null
                    unsubscribed_at: string | null
                    error_message: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    subject: string
                    content: Json
                    sent_at?: string
                    status?: string
                    trust_score?: number | null
                    engines_used?: string[] | null
                    processing_time?: number | null
                    opened_at?: string | null
                    clicked_at?: string | null
                    unsubscribed_at?: string | null
                    error_message?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    subject?: string
                    content?: Json
                    sent_at?: string
                    status?: string
                    trust_score?: number | null
                    engines_used?: string[] | null
                    processing_time?: number | null
                    opened_at?: string | null
                    clicked_at?: string | null
                    unsubscribed_at?: string | null
                    error_message?: string | null
                    created_at?: string
                }
            }
            referrals: {
                Row: {
                    id: string
                    referrer_id: string
                    referred_email: string
                    referred_user_id: string | null
                    referral_code: string // Code used
                    status: string // pending, completed, rewarded
                    reward_type: string | null
                    reward_claimed_at: string | null
                    created_at: string
                    completed_at: string | null
                }
                Insert: {
                    id?: string
                    referrer_id: string
                    referred_email: string
                    referred_user_id?: string | null
                    referral_code: string
                    status?: string
                    reward_type?: string | null
                    reward_claimed_at?: string | null
                    created_at?: string
                    completed_at?: string | null
                }
                Update: {
                    id?: string
                    referrer_id?: string
                    referred_email?: string
                    referred_user_id?: string | null
                    referral_code?: string
                    status?: string
                    reward_type?: string | null
                    reward_claimed_at?: string | null
                    created_at?: string
                    completed_at?: string | null
                }
            }
            email_events: {
                Row: {
                    id: string
                    newsletter_send_id: string | null
                    user_id: string
                    event_type: string
                    url: string | null
                    user_agent: string | null
                    ip_address: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    newsletter_send_id?: string | null
                    user_id: string
                    event_type: string
                    url?: string | null
                    user_agent?: string | null
                    ip_address?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    newsletter_send_id?: string | null
                    user_id?: string
                    event_type?: string
                    url?: string | null
                    user_agent?: string | null
                    ip_address?: string | null
                    created_at?: string
                }
            }
            newsletter_feedback: {
                Row: {
                    id: string
                    newsletter_send_id: string | null
                    user_id: string
                    feedback_type: string
                    question_id: string | null
                    answer: string | null
                    rating: number | null
                    comment: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    newsletter_send_id?: string | null
                    user_id: string
                    feedback_type: string
                    question_id?: string | null
                    answer?: string | null
                    rating?: number | null
                    comment?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    newsletter_send_id?: string | null
                    user_id?: string
                    feedback_type?: string
                    question_id?: string | null
                    answer?: string | null
                    rating?: number | null
                    comment?: string | null
                    created_at?: string
                }
            }
            interests: {
                Row: {
                    id: string
                    name: string
                    emoji: string
                    category: string
                }
                Insert: {
                    id?: string
                    name: string
                    emoji: string
                    category: string
                }
                Update: {
                    id?: string
                    name?: string
                    emoji?: string
                    category?: string
                }
            }
            user_interests: {
                Row: {
                    user_id: string
                    interest_id: string
                    created_at: string
                }
                Insert: {
                    user_id: string
                    interest_id: string
                    created_at?: string
                }
                Update: {
                    user_id?: string
                    interest_id?: string
                    created_at?: string
                }
            }
        }
        Views: {
            [_: string]: {
                Row: {
                    [key: string]: any
                }
            }
        }
        Functions: {
            generate_referral_code: {
                Args: {
                    user_id: string
                }
                Returns: string
            }
        }
    }
}
