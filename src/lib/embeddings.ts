// Company Brain embeddings — OpenAI text-embedding-3-small (1536 dims).
//
// GRACEFUL DEGRADATION: when OPENAI_API_KEY is unset, embedText returns null
// (never throws). Callers must handle the null case:
//   - ingestion stores the brain_entry row WITHOUT an embedding
//   - search falls back to ilike keyword matching
// The feature is therefore testable today and lights up fully the moment Ana
// adds OPENAI_API_KEY to the environment.
//
// We call the OpenAI REST API via fetch (NOT the SDK) to avoid package.json
// churn — see the build brief.

const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings'
const EMBEDDING_MODEL = 'text-embedding-3-small'
export const EMBEDDING_DIMS = 1536

/**
 * Embed a single text chunk. Returns a 1536-dim vector, or null when the key
 * is missing OR the API call fails (so ingestion never blocks on embeddings).
 */
export async function embedText(text: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    console.warn(
      '[brain/embeddings] OPENAI_API_KEY not set — storing entry without an embedding. ' +
      'Semantic search will fall back to keyword match until the key is added.'
    )
    return null
  }

  const input = (text || '').trim()
  if (!input) return null

  try {
    const res = await fetch(OPENAI_EMBEDDINGS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input,
        // text-embedding-3-small natively returns 1536 dims; pin it so a future
        // model swap can't silently change the column width.
        dimensions: EMBEDDING_DIMS,
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error(`[brain/embeddings] OpenAI returned ${res.status}: ${detail.slice(0, 300)}`)
      return null
    }

    const json = (await res.json()) as {
      data?: Array<{ embedding?: number[] }>
    }
    const vector = json.data?.[0]?.embedding
    if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMS) {
      console.error('[brain/embeddings] Unexpected embedding shape from OpenAI.')
      return null
    }
    return vector
  } catch (err) {
    console.error('[brain/embeddings] fetch failed:', err)
    return null
  }
}

/** Whether embeddings are currently available (key present). UI / fallback hint. */
export function embeddingsEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY)
}

/** pgvector literal: a JS number[] must be serialized as '[1,2,3]' for the
 *  vector column. Returns null for null input. */
export function toVectorLiteral(vector: number[] | null): string | null {
  if (!vector) return null
  return `[${vector.join(',')}]`
}
