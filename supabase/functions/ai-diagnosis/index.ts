import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function errorResponse(status: number, msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // JWT validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse(401, "Unauthorized");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return errorResponse(401, "Invalid or expired token");
    }

    const { issueType, issueSubType, answers, action } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Only run_diagnosis action is supported — questions are hardcoded on the frontend
    if (action !== "run_diagnosis") {
      return errorResponse(400, "Invalid action. Only 'run_diagnosis' is supported.");
    }

    const qaText = answers?.map((a: any) => `Q: ${a.question}\nA: ${a.answer}`).join('\n') || 'No answers provided';
    const diagTool = {
      type: "function",
      function: {
        name: "provide_diagnosis",
        parameters: {
          type: "object",
          properties: {
            causes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  cause: { type: "string" },
                  probability: { type: "number" },
                  severity: { type: "string", enum: ["low", "medium", "high"] },
                  solution: { type: "string" },
                  estimatedCost: { type: "string" },
                  requiredParts: { type: "array", items: { type: "object", properties: { name: { type: "string" }, estimatedPrice: { type: "string" } }, required: ["name", "estimatedPrice"] } }
                },
                required: ["cause", "probability", "severity", "solution", "estimatedCost"]
              }
            },
            summary: { type: "string" },
            urgency: { type: "string", enum: ["low", "medium", "high", "critical"] },
            recommendedAction: { type: "string" }
          },
          required: ["causes", "summary", "urgency", "recommendedAction"]
        }
      }
    };

    const startTime = Date.now();
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Maintenance expert for PG/Hostel. Analyze answers, provide diagnosis in simple language. Multiple causes with probability %. Include solutions, parts, and costs in Indian Rupees." },
          { role: "user", content: `Issue: ${issueType}${issueSubType ? ` - ${issueSubType}` : ''}\n\n${qaText}\n\nProvide diagnosis with root causes, solutions, parts, and cost estimates.` }
        ],
        tools: [diagTool],
        tool_choice: { type: "function", function: { name: "provide_diagnosis" } },
      }),
    });

    console.log(`AI diagnosis response time: ${Date.now() - startTime}ms`);

    if (!response.ok) {
      if (response.status === 429) return errorResponse(429, "Rate limited, please try again.");
      if (response.status === 402) return errorResponse(402, "Credits exhausted.");
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const tc = data.choices?.[0]?.message?.tool_calls?.[0];
    if (tc) return new Response(JSON.stringify(JSON.parse(tc.function.arguments)), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    throw new Error("No diagnosis result");
  } catch (e) {
    console.error("ai-diagnosis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
