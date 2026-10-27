export async function onRequestPost({ request, env }) {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  const send = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers });

  if (!env.GEMINI_API_KEY) {
    return send({ error: "Gemini API key is not configured." }, 503);
  }

  try {
    const length = Number(request.headers.get("Content-Length") || 0);
    if (length > 8192) return send({ error: "Request too large." }, 413);

    const body = await request.json();
    const message = body.message;

    if (typeof message !== "string" || !message.trim() || message.length > 4000) {
      return send({ error: "Enter a message of up to 4000 characters." }, 400);
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: "You are JARVIS PRIME, a professional AI assistant. Be accurate, concise and helpful. Never claim to control a device without an authorized tool." }]
          },
          contents: [{ role: "user", parts: [{ text: message.trim() }] }],
          generationConfig: { maxOutputTokens: 800 }
        })
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error("Gemini API error:", response.status);
      return send({ error: "Gemini is temporarily unavailable. Check the API configuration." }, 502);
    }

    const reply = (data.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || "").join("").trim();

    if (!reply) return send({ error: "Gemini returned an empty response." }, 502);
    return send({ reply, engine: "gemini-2.5-flash", fallback: false });
  } catch {
    return send({ error: "Invalid request or network error." }, 400);
  }
}
