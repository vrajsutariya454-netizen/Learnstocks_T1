export const maxDuration = 30

interface Message {
  role: "user" | "assistant"
  content: string
}

export async function POST(req: Request) {
  try {
    const { messages }: { messages: Message[] } = await req.json()

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: messages,
        max_tokens: 2000,
        temperature: 0.7,
        stream: false,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("[v0] Groq API Error:", error)
      return Response.json({ error: "Failed to generate response" }, { status: 500 })
    }

    const data = await response.json()
    console.log("[v0] Groq API Response received successfully")

    const text = data.choices?.[0]?.message?.content || ""

    return Response.json({ text })
  } catch (error) {
    console.error("[v0] API Error:", error)
    return Response.json({ error: "Failed to generate response" }, { status: 500 })
  }
}
