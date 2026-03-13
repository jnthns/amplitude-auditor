const MODELS = ['gemini-3-flash-preview', 'gemini-2.5-flash'] as const

function safeParseJSON(text: string): unknown {
  const cleaned = text.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const match = cleaned.match(/(?:\{[\s\S]*\}|\[[\s\S]*\])/)
    if (match) {
      return JSON.parse(match[0])
    }
    throw new Error('Failed to parse Gemini response as JSON')
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function callGemini(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  model: string,
  maxOutputTokens: number = 16384,
  retries: number = 3,
): Promise<unknown> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2,
              maxOutputTokens,
            },
          }),
        },
      )

      if (response.status === 429) {
        const waitMs = Math.min(60000, 2000 * Math.pow(2, attempt))
        console.warn(`Rate limited on ${model}, waiting ${waitMs}ms (attempt ${attempt + 1})`)
        await wait(waitMs)
        continue
      }

      if (!response.ok) {
        const errBody = await response.text().catch(() => '')
        throw new Error(`Gemini ${response.status}: ${errBody.slice(0, 200)}`)
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>
          }
        }>
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) {
        throw new Error('Empty response from Gemini')
      }

      return safeParseJSON(text)
    } catch (error) {
      if (attempt === retries - 1) throw error
      await wait(3000 * (attempt + 1))
    }
  }

  throw new Error('All retries exhausted')
}

export async function callWithFallback(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxOutputTokens?: number,
): Promise<unknown> {
  for (const model of MODELS) {
    try {
      return await callGemini(apiKey, systemPrompt, userPrompt, model, maxOutputTokens)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const isLast = model === MODELS[MODELS.length - 1]
      if (message.includes('429') && !isLast) {
        console.warn(`All retries on ${model} exhausted, falling back to next model`)
        continue
      }
      throw error
    }
  }

  throw new Error('All models exhausted')
}
