export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed." });

  if (!process.env.GEMINI_API_KEY)
    return res.status(503).json({ error: "Gemini API key is not configured." });

  try {
    const { message } = req.body || {};
    if (typeof message !== "string" || !message.trim() || message.length > 4000)
      return res.status(400).json({ error: "Enter a message of up to 4000 characters." });

    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: "You are JARVIS PRIME, a professional AI assistant. Be accurate, concise and helpful. Never claim to control a device without an authorized tool." }] },
          contents: [{ role: "user", parts: [{ text: message.trim() }] }],
          generationConfig: { maxOutputTokens: 800 }
        })
      }
    );

    const data = await r.json();
    if (!r.ok) {
      const googleMessage = data?.error?.message || "No details returned";
      console.error("Gemini failure:", JSON.stringify({
        status: r.status,
        message: googleMessage.slice(0, 500)
      }));
      return res.status(502).json({
        error: "Gemini request failed.",
        googleStatus: r.status,
        details: googleMessage.slice(0, 300)
      });
    }

    const reply = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("").trim();
    if (!reply) return res.status(502).json({ error: "Gemini returned an empty response." });

    return res.status(200).json({ reply, engine: "gemini-2.5-flash", fallback: false });
  } catch {
    return res.status(500).json({ error: "A server error occurred." });
  }
}
