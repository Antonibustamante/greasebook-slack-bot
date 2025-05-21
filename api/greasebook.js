export const config = { runtime: "edge" };

export default async function handler(request) {
  // Parse Slack's form-encoded payload
  const body = await request.text();
  const params = new URLSearchParams(body);
  const text = params.get("text");
  const response_url = params.get("response_url");

  // Call OpenAI Chat Completions API
  const apiKey = process.env.OPENAI_API_KEY;
  const completionRes = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o", // Use "gpt-4o", "gpt-4-turbo", or "gpt-3.5-turbo" if needed
        messages: [
          { role: "system", content: "You are Greasebook's helpful assistant." },
          { role: "user", content: text }
        ],
        max_tokens: 300,
      }),
    }
  );
  const completionData = await completionRes.json();
  console.log("OpenAI RAW RESPONSE:", JSON.stringify(completionData));
  const answer =
    completionData.choices?.[0]?.message?.content ||
    "Sorry, I couldn't get an answer.";

  // Reply back to Slack inline
  if (response_url) {
    await fetch(response_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        response_type: "in_channel",
        text: answer,
      }),
    });
  }

  // Acknowledge immediately
  return new Response("", { status: 200 });
}