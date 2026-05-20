import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, headline, location, summary, whatsapp_number, skills, work_history, ai_tier, cv_kit_purchased, cv_tier, linkedin_url, github_url, website_url, portfolio_url, native_language, nationality, languages_spoken, language_proficiency, english_level, cv_language_preference, skill_quadrant, verification_tier, matched_industries, industry_chats, career_recommendations, ai_resilience_score, continuous_learning')
    .eq('id', user.id)
    .single()

  return NextResponse.json({ profile: profile ? { ...profile, id: user.id } : null })
}
