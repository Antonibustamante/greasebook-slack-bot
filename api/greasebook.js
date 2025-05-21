export const config = { runtime: "edge" };

async function runCompletion(userPrompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  const assistantId = process.env.OPENAI_ASSISTANT_ID;

  // 1) Create a new thread
  const threadRes = await fetch("https://api.openai.com/v1/threads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({}),
  });
  const thread = await threadRes.json();

  // 2) Post user message to thread
  await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      role: "user",
      content: userPrompt,
    }),
  });

  // 3) Run the assistant on that thread
  const runRes = await fetch(
    `https://api.openai.com/v1/threads/${thread.id}/runs`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        assistant_id: assistantId,
      }),
    }
  );
  const run = await runRes.json();

  // 4) Poll until completed (max 10 tries)
  let result;
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(
      `https://api.openai.com/v1/threads/${thread.id}/runs/${run.id}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );
    result = await pollRes.json();
    if (result.status === "completed") break;
  }

  // 5) Fetch all messages in thread and return the last assistant reply
  const messagesRes = await fetch(
    `https://api.openai.com/v1/threads/${thread.id}/messages`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
  const messages = await messagesRes.json();
  const last = messages.data?.[messages.data.length - 1];
  return (last.content?.[0]?.text?.value) || "Sorry, I couldn't get an answer.";
}

export default async function handler(request) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const text = params.get("text");
  const response_url = params.get("response_url");

  // Run the Assistant
  const answer = await runCompletion(text);

  // Post reply back into Slack
  await fetch(response_url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      response_type: "in_channel",
      text: answer,
    }),
  });

  // Acknowledge immediately
  return new Response(null, { status: 200 });
}