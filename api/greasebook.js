export const config = { runtime: "edge" };

import OpenAI from "openai-edge";
import { URLSearchParams } from "url";

export default async function handler(request) {
  // 1) Parse the incoming slash-command payload
  const body = await request.text();
  const params = new URLSearchParams(body);
  const text = params.get("text");
  const response_url = params.get("response_url");

  // 2) Query your OpenAI Assistant
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const conv = await openai.chat.completions.create({
    assistant: process.env.OPENAI_ASSISTANT_ID,
    messages: [{ role: "user", content: text }],
  });
  const answer = conv.choices[0].message.content;

  // 3) Post the reply back to Slack inline
  await fetch(response_url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      response_type: "in_channel",
      text: answer,
    }),
  });

  // 4) Acknowledge immediately
  return new Response("", { status: 200 });
}