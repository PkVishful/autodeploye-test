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

    const { image_url } = await req.json();
    if (!image_url) {
      return new Response(JSON.stringify({ error: "image_url is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are an invoice data extractor. Extract product/asset details from invoice images. Return structured data using the provided tool."
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the following details from this invoice image: brand name, model name/number, serial number, purchase price (total amount), invoice number, invoice date (in YYYY-MM-DD format), warranty period if mentioned, vendor/seller name, and product capacity if applicable (e.g., tons for AC, litres for fridge, kg for washing machine, watts for induction). If a field is not found, return null for it." },
              { type: "image_url", image_url: { url: image_url } }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_invoice_data",
              description: "Extract structured product details from an invoice image",
              parameters: {
                type: "object",
                properties: {
                  brand: { type: "string", description: "Brand/manufacturer name" },
                  model: { type: "string", description: "Model name or number" },
                  serial_number: { type: "string", description: "Serial number" },
                  purchase_price: { type: "number", description: "Total purchase price" },
                  invoice_number: { type: "string", description: "Invoice number" },
                  invoice_date: { type: "string", description: "Invoice date in YYYY-MM-DD format" },
                  warranty_expiry: { type: "string", description: "Warranty expiry date in YYYY-MM-DD format, if determinable" },
                  vendor_name: { type: "string", description: "Vendor/seller name from the invoice" },
                  capacity_value: { type: "number", description: "Product capacity number (e.g., 1.5 for 1.5 ton AC)" },
                  capacity_unit: { type: "string", enum: ["tons", "litres", "kgs", "watts"], description: "Unit of capacity" },
                },
                required: ["brand", "model", "purchase_price", "invoice_number", "invoice_date"],
                additionalProperties: false,
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_invoice_data" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error("No structured data returned from AI");
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scan-invoice error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
