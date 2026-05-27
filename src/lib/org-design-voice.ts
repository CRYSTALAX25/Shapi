// Voice-driven Target-State Org Design intake (STRATEGY §16).
//
// The hiring manager texts "design my org via voice" → the webhook walks them
// through 3 sequential voice-note prompts. Each answer is transcribed (or
// accepted as text if voice transcription fails) and stored in the profile's
// `org_design_voice_state` jsonb. On step 3 the webhook mints a magic-link
// token (org_design_intake_tokens) and WhatsApps them the link.
//
// This file holds the pure helpers — intent detection, prompts, and the state
// shape — so the webhook stays slim. The state machine itself lives in the
// webhook (it needs request context: profile, formData, sendWhatsApp).

export type OrgDesignVoiceState = {
  step: 1 | 2 | 3
  current_team_text?: string
  strategy_text?: string
  ai_plan_text?: string
  started_at?: string
}

// Matches the trigger phrase variants the manager might use. Permissive but
// anchored on the word "voice" + a hint of org/team design so we don't
// false-positive on the plain "design my org" command (which already routes
// to the web-form link in the existing webhook).
//
// Regex: /(?:design\s+my\s+org(?:anisation|anization)?\s+via\s+voice|voice\s+design\s+(?:my\s+)?org(?:anisation|anization)?|voice\s+org\s+design|org\s+design\s+via\s+voice|design\s+(?:my\s+)?org\s+by\s+voice|voice\s+design\s+(?:my\s+)?team)/i
export function parseOrgDesignTrigger(text: string): boolean {
  if (!text) return false
  const lower = text.toLowerCase().trim()
  return /(?:design\s+my\s+org(?:anisation|anization)?\s+via\s+voice|voice\s+design\s+(?:my\s+)?org(?:anisation|anization)?|voice\s+org\s+design|org\s+design\s+via\s+voice|design\s+(?:my\s+)?org\s+by\s+voice|voice\s+design\s+(?:my\s+)?team)/i.test(lower)
}

// The user can type "cancel" / "stop" / "quit" mid-flow to abort.
export function parseOrgDesignCancel(text: string): boolean {
  if (!text) return false
  return /^(?:cancel|stop|quit|exit|abort|nevermind|never\s+mind)$/i.test(text.trim())
}

export function getNextPrompt(step: 1 | 2 | 3): string {
  if (step === 1) {
    return `🏛️ Let's design your future org via voice. *Question 1 of 3:* Send a voice note (any length) describing **the team you have today** — rough roles, headcount per function. No names, just role + count.\n\n_Type "cancel" anytime to stop._`
  }
  if (step === 2) {
    return `Great. *Question 2 of 3:* Now send a voice note about **your strategy** — what's the company going after over the next 1–2 years? Markets, products, customers.`
  }
  return `Last one. *Question 3 of 3:* Send a voice note about **your AI integration plans** — which functions you want AI to augment, where you're piloting, what's holding you back.`
}

// Field on org_design_voice_state that holds the answer for the given step.
export function fieldForStep(step: 1 | 2 | 3): 'current_team_text' | 'strategy_text' | 'ai_plan_text' {
  if (step === 1) return 'current_team_text'
  if (step === 2) return 'strategy_text'
  return 'ai_plan_text'
}
