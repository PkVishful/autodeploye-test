import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // JWT validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const userId = user.id;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = roles?.some((r: any) => ["super_admin", "org_admin", "property_manager"].includes(r.role));
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { ticketData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an AI maintenance analytics expert for Vishful PG (Paying Guest accommodation).
Analyze the provided maintenance ticket data and generate actionable insights.

Return your analysis as a JSON object with this exact structure:
{
  "issueFrequency": { "summary": "string", "details": ["string"] },
  "predictiveMaintenance": { "summary": "string", "alerts": [{ "location": "string", "issue": "string", "recommendation": "string" }] },
  "employeePerformance": { "summary": "string", "highlights": ["string"] },
  "costAnalysis": { "summary": "string", "insights": ["string"] },
  "generalInsights": ["string"]
}

Be specific with numbers and percentages. Identify patterns. Flag urgent issues.
If data is insufficient, still provide observations based on what's available.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze this maintenance ticket data:\n${JSON.stringify(ticketData)}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_analysis",
              description: "Return structured maintenance analytics",
              parameters: {
                type: "object",
                properties: {
                  issueFrequency: {
                    type: "object",
                    properties: { summary: { type: "string" }, details: { type: "array", items: { type: "string" } } },
                    required: ["summary", "details"]
                  },
                  predictiveMaintenance: {
                    type: "object",
                    properties: {
                      summary: { type: "string" },
                      alerts: { type: "array", items: { type: "object", properties: { location: { type: "string" }, issue: { type: "string" }, recommendation: { type: "string" } }, required: ["location", "issue", "recommendation"] } }
                    },
                    required: ["summary", "alerts"]
                  },
                  employeePerformance: {
                    type: "object",
                    properties: { summary: { type: "string" }, highlights: { type: "array", items: { type: "string" } } },
                    required: ["summary", "highlights"]
                  },
                  costAnalysis: {
                    type: "object",
                    properties: { summary: { type: "string" }, insights: { type: "array", items: { type: "string" } } },
                    required: ["summary", "insights"]
                  },
                  generalInsights: { type: "array", items: { type: "string" } }
                },
                required: ["issueFrequency", "predictiveMaintenance", "employeePerformance", "costAnalysis", "generalInsights"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "provide_analysis" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    let analysis;

    if (toolCall?.function?.arguments) {
      analysis = typeof toolCall.function.arguments === 'string'
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } else {
      const content = result.choices?.[0]?.message?.content || '';
      try {
        analysis = JSON.parse(content);
      } catch {
        analysis = {
          issueFrequency: { summary: content, details: [] },
          predictiveMaintenance: { summary: "Unable to parse", alerts: [] },
          employeePerformance: { summary: "Unable to parse", highlights: [] },
          costAnalysis: { summary: "Unable to parse", insights: [] },
          generalInsights: [content],
        };
      }
    }

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ticket-analytics error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
