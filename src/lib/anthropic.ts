// Shared Anthropic client with automatic prompt caching.
//
// Every agent/workflow in Shapi should get its client from getAnthropic() rather
// than calling `new Anthropic(...)` directly, so the caching policy lives in ONE
// place. The client returned here transparently adds `cache_control` breakpoints
// to outgoing `messages.create` / `messages.stream` calls:
//
//   1. The stable SYSTEM prefix is cached. A breakpoint on the last system block
//      caches tools + system together (render order is tools → system → messages),
//      so every request that reuses the same system prompt reads it from cache
//      (~0.1x input price) instead of reprocessing it. This is the big win for our
//      conversational surfaces (cv-builder, AskShapi, onboarding-chat, whatsapp).
//
//   2. For multi-turn conversations (messages.length >= 2), the most-recent turn is
//      also cached, so the growing history prefix is reused turn-over-turn.
//
// Caching is a prefix match: a single byte change anywhere before a breakpoint
// invalidates everything after it. We therefore never cache a single one-shot user
// turn (no reusable prefix → cache writes that are never read), and we leave callers
// who already set their own cache_control untouched.
//
// Note: a prefix shorter than the model minimum (~2048 tokens on Sonnet 4.6, ~4096
// on Opus/Haiku) silently won't cache — no error, no benefit, no cost. Adding the
// breakpoint anyway is harmless, so we apply it uniformly.
import Anthropic from '@anthropic-ai/sdk'

type CreateParams = Anthropic.Messages.MessageCreateParams

const EPHEMERAL = { type: 'ephemeral' as const }

function isCached(content: unknown): boolean {
  return (
    Array.isArray(content) &&
    content.some(
      (b) => b && typeof b === 'object' && (b as { cache_control?: unknown }).cache_control != null,
    )
  )
}

// Put a cache breakpoint on the last block of the stable system prefix.
function cacheSystem(system: CreateParams['system']): CreateParams['system'] {
  if (typeof system === 'string') {
    if (!system.trim()) return system
    return [{ type: 'text', text: system, cache_control: EPHEMERAL }]
  }
  if (Array.isArray(system) && system.length > 0 && !isCached(system)) {
    const last = system.length - 1
    return system.map((block, i) =>
      i === last ? { ...block, cache_control: EPHEMERAL } : block,
    )
  }
  return system
}

// For multi-turn conversations, cache the most-recent turn so the growing prefix
// is reused on the next request. Only touches string content (the common chat
// shape) — block-form content (tool use, images) is left exactly as the caller
// built it.
function cacheLastTurn(messages: CreateParams['messages']): CreateParams['messages'] {
  if (!Array.isArray(messages) || messages.length < 2) return messages
  const idx = messages.length - 1
  const last = messages[idx]
  if (typeof last.content !== 'string' || !last.content.trim()) return messages
  const copy = messages.slice()
  copy[idx] = {
    ...last,
    content: [{ type: 'text', text: last.content, cache_control: EPHEMERAL }],
  }
  return copy
}

function withCaching<T extends CreateParams>(params: T): T {
  const next = { ...params }
  if (next.system != null) next.system = cacheSystem(next.system)
  if (Array.isArray(next.messages)) next.messages = cacheLastTurn(next.messages)
  return next
}

/**
 * Returns an Anthropic client that automatically applies prompt caching to all
 * `messages.create` and `messages.stream` calls. Drop-in replacement for
 * `new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })`.
 */
export function getAnthropic(): Anthropic {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const messages = client.messages
  const origCreate = messages.create.bind(messages)
  const origStream = messages.stream.bind(messages)

  messages.create = ((params: CreateParams, options?: unknown) =>
    origCreate(withCaching(params), options as never)) as typeof messages.create
  messages.stream = ((params: CreateParams, options?: unknown) =>
    origStream(withCaching(params), options as never)) as typeof messages.stream

  return client
}
