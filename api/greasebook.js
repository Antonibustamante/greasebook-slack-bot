

import OpenAI from "openai";
import fetch from "node-fetch";

export default async function handler(req, res) {
  const { text, response_url } = req.body;
  // 1) Acknowledge immediately so Slack never times out
  res.status(200).end();

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
}