export const config = { runtime: "edge" };

async function getAssistantAnswer(userPrompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  const assistantId = process.env.OPENAI_ASSISTANT_ID;

  // 1. Create a thread
  const threadRes = await fetch("https://api.openai.com/v1/threads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({}),
  });
  const thread = await threadRes.json();

  // 2. Add user's message to the thread
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

  // 3. Run the assistant
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

  // 4. Poll for completion (max 10 tries)
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

  // 5. Get the last assistant message in the thread (defensive, logs errors)
  const messagesRes = await fetch(
    `https://api.openai.com/v1/threads/${thread.id}/messages`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
  const messages = await messagesRes.json();
  const last = messages.data?.[messages.data.length - 1];

  if (!last || !last.content || !last.content[0] || !last.content[0].text || !last.content[0].text.value) {
    console.error("OpenAI Messages Raw:", JSON.stringify(messages, null, 2));
    return "Sorry, the Assistant did not return a valid response. Check logs for details.";
  }
  return last.content[0].text.value;
}

export default async function handler(request) {
  // Parse Slack's form-encoded payload
  const body = await request.text();
  const params = new URLSearchParams(body);
  const text = params.get("text");
  const response_url = params.get("response_url");

  // Respond immediately to Slack (avoid timeout)
  const immediateResponse = new Response("Working on it...", { status: 200 });

  // Do the Assistant processing in the background
  getAssistantAnswer(text).then(answer => {
    if (response_url) {
      fetch(response_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response_type: "in_channel",
          text: answer,
        }),
      });
    }
  });

  // Return instantly to Slack
  return immediateResponse;
}