import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { imageUrl } = await req.json();
    if (!imageUrl) {
      return new Response(JSON.stringify({ error: 'imageUrl is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Download the image and convert to base64
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch image' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    // Convert to base64 safely for large images (spread operator fails on big arrays)
    const bytes = new Uint8Array(imageBuffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64Image = btoa(binary);
    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

    // Call Gemini Vision API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
              text: `You are an expert electricity meter reader. Analyze this photo carefully.

STEP 1 - APARTMENT NUMBER:
Look for an apartment number or label. It is typically printed as BLACK TEXT on a GOLDEN/YELLOW background sticker or label attached on or near the meter. Extract this code exactly as written.

STEP 2 - METER READING (kWh):
Look at the meter display. Find the reading that shows energy consumption in kWh (kilowatt-hours). This is usually the main numeric LCD/digital display or mechanical digit counter on the meter. Read all digits carefully including any decimal places.

IMPORTANT: The reading MUST be in kWh. If the display shows a different unit (like kVAh, kVA, V, A, or any other non-kWh unit), set reading_value to null and set error to "Wrong reading unit detected. Please take a photo showing the kWh reading."

STEP 3 - Return ONLY a JSON object (no markdown, no backticks, no explanation):
{
  "reading_value": <number or null>,
  "apartment_code": "<string or null>",
  "confidence": "high" | "medium" | "low",
  "unit": "kWh",
  "error": "<error message string or null>"
}`
              },
              {
                inlineData: {
                  mimeType,
                  data: base64Image,
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error('Gemini API error:', errText);
      return new Response(JSON.stringify({ error: 'OCR service error' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geminiData = await geminiResponse.json();
    const textContent = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('Gemini raw response:', textContent);

    // Parse the JSON from Gemini's response
    let result: any = { reading_value: null, apartment_code: null, confidence: 'low', unit: 'kWh', error: null };
    try {
      // Strip markdown code fences and any surrounding text to find JSON
      let cleaned = textContent.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      // If there's text before the JSON object, extract just the JSON
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }
      result = JSON.parse(cleaned);
    } catch {
      console.error('Failed to parse Gemini response:', textContent);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('scan-meter-reading error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
