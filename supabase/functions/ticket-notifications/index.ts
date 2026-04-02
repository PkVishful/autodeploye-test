const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TEMPLATES: Record<string, { message: string; vars: string[] }> = {
  ticket_assigned: { message: '212445', vars: ['employeeName', 'ticketNumber'] },
  cost_approval:   { message: '212446', vars: ['ticketNumber'] },
  ticket_closed:   { message: '212448', vars: ['name', 'ticketNumber'] },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { event, ticketNumber, employeeName, name, phoneNumber } = body;

    if (!event || !ticketNumber) {
      return new Response(JSON.stringify({ error: 'Missing event or ticketNumber' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const template = TEMPLATES[event];
    if (!template) {
      return new Response(JSON.stringify({ error: `Unknown event: ${event}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('FAST2SMS_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'FAST2SMS_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine target phone number — send to actual recipient
    const testMode = false;
    const targetNumber = phoneNumber;

    if (!targetNumber) {
      return new Response(JSON.stringify({ error: 'No phone number available' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build variables_values based on template
    let variablesValues = '';
    if (event === 'ticket_assigned') {
      variablesValues = `${employeeName || 'Employee'}|${ticketNumber}`;
    } else if (event === 'cost_approval') {
      variablesValues = `${ticketNumber}`;
    } else if (event === 'ticket_closed') {
      variablesValues = `${name || 'User'}|${ticketNumber}`;
    }

    const payload = {
      route: 'dlt',
      sender_id: 'VISHFL',
      message: template.message,
      variables_values: variablesValues,
      flash: 0,
      numbers: targetNumber,
    };

    const smsResp = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const smsResult = await smsResp.json();

    return new Response(JSON.stringify({
      success: true,
      testMode,
      targetNumber,
      smsResult,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
