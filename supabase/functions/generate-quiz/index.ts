
// @ts-nocheck
// deno-lint-ignore-file

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { topic = "General Stock Market", difficulty = "Medium" } = await req.json();

        if (!GROQ_API_KEY) {
            throw new Error("GROQ_API_KEY not found");
        }

        const systemPrompt = `You are a financial education assistant. Generate 5 multiple-choice questions about '${topic}' at '${difficulty}' difficulty level.
    Return strictly a JSON array of objects. Each object must have:
    - id: a unique string
    - text: the question text
    - options: an array of 4 string options
    - correctOption: the index (0-3) of the correct option
    - explanation: a brief explanation of the answer
    - difficulty: string ('${difficulty}')
    
    Do not output any markdown formatting, just the raw JSON array.`;

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "llama3-8b-8192", // Using the model from .env or a reliable default
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: "Generate the questions now." }
                ],
                temperature: 0.7,
                max_tokens: 1024,
            }),
        });

        const data = await response.json();

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error("Invalid response from Groq API");
        }

        const content = data.choices[0].message.content;

        // Parse the content, ensuring it's valid JSON
        // Sometimes LLMs add backticks, clean them
        const cleanContent = content.replace(/```json/g, "").replace(/```/g, "").trim();
        const questions = JSON.parse(cleanContent);

        return new Response(JSON.stringify({ questions }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error) {
        console.error("generate-quiz error", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 500,
            }
        );
    }
});
