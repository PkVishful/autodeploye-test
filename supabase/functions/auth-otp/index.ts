import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendOtpViaSms(phone: string, otp: string, smsEnabled: boolean): Promise<boolean> {
  if (!smsEnabled) {
    console.log(`[Fast2SMS] SMS disabled. OTP for ${phone}: ${otp}`);
    return true; // Simulate success when disabled
  }

  const apiKey = Deno.env.get('FAST2SMS_API_KEY');
  if (!apiKey) {
    console.error('[Fast2SMS] FAST2SMS_API_KEY not configured.');
    return false;
  }

  try {
    const cleanPhone = phone.replace(/[^0-9]/g, '').replace(/^91/, '');
    console.log(`[Fast2SMS] Sending OTP to ${cleanPhone} via DLT route`);

    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route: 'dlt',
        sender_id: 'VISHFL',
        message: '163996',
        variables_values: otp,
        schedule_time: '',
        flash: 0,
        numbers: cleanPhone,
      }),
    });

    const result = await response.json();
    console.log('[Fast2SMS] Response:', JSON.stringify(result));

    if (!response.ok || result.return === false) {
      console.error('[Fast2SMS] Failed:', JSON.stringify(result));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Fast2SMS] Network error:', err);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone, otp, action, sms_enabled } = await req.json()

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
    const cleanPhone = phone.replace(/[^0-9]/g, '').replace(/^91/, '')
    const phoneVariants = [cleanPhone, `+91${cleanPhone}`, `91${cleanPhone}`]

    // Resolve SMS toggle: client can pass sms_enabled, or default to true
    const isSmsEnabled = sms_enabled !== false;

    if (action === 'send_otp') {
      let foundTeamMember = null
      for (const variant of phoneVariants) {
        const { data } = await supabaseAdmin.from('team_members').select('id, status').eq('phone', variant).maybeSingle()
        if (data) { foundTeamMember = data; break }
      }

      let foundTenant = null
      for (const variant of phoneVariants) {
        const { data } = await supabaseAdmin.from('tenants').select('id, full_name, staying_status, phone').eq('phone', variant).maybeSingle()
        if (data) { foundTenant = data; break }
      }

      if (!foundTeamMember && !foundTenant) {
        return new Response(JSON.stringify({ error: 'User not found. Please contact your administrator.' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (foundTeamMember && foundTeamMember.status !== 'active') {
        return new Response(JSON.stringify({
          error: `Access denied. Your team account is currently "${foundTeamMember.status}". Contact your administrator.`
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      if (!foundTeamMember && foundTenant) {
        const tenantStatus = (foundTenant.staying_status || '').toLowerCase()
        if (tenantStatus === 'new') {
          return new Response(JSON.stringify({
            error: 'Your status is "New". You will be able to log in once onboarding is completed.'
          }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        const allowedStatuses = ['staying', 'on-notice', 'booked']
        if (!allowedStatuses.includes(tenantStatus)) {
          return new Response(JSON.stringify({
            error: `Access denied. Your tenant status is "${foundTenant.staying_status || 'unknown'}". Only active tenants can log in.`
          }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
      }

      const generatedOtp = generateOtp();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      await supabaseAdmin.from('otp_codes').delete().eq('phone', cleanPhone);

      const { data: insertedOtp, error: insertError } = await supabaseAdmin.from('otp_codes').insert({
        phone: cleanPhone, otp_code: generatedOtp, expires_at: expiresAt,
      }).select();

      if (insertError) {
        console.error('[OTP] Failed to store OTP:', insertError);
        return new Response(JSON.stringify({ error: 'Failed to generate OTP. Please try again.' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const sent = await sendOtpViaSms(cleanPhone, generatedOtp, isSmsEnabled);
      if (!sent) {
        await supabaseAdmin.from('otp_codes').delete().eq('phone', cleanPhone);
        return new Response(JSON.stringify({ error: 'Failed to send OTP via SMS. Please try again.' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, message: 'OTP sent successfully' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'verify_otp') {
      if (!otp || otp.length !== 6) {
        return new Response(JSON.stringify({ error: 'Please enter a valid 6-digit OTP.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { data: otpRecord } = await supabaseAdmin.from('otp_codes')
        .select('*')
        .eq('phone', cleanPhone)
        .eq('otp_code', otp)
        .eq('verified', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!otpRecord) {
        return new Response(JSON.stringify({ error: 'Invalid or expired OTP. Please request a new one.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      await supabaseAdmin.from('otp_codes').update({ verified: true }).eq('id', otpRecord.id);

      const email = `${cleanPhone}@vishful.local`
      const password = `vishful_otp_${cleanPhone}_${Date.now()}_secure`

      let foundTeamMember = null
      for (const variant of phoneVariants) {
        const { data } = await supabaseAdmin.from('team_members').select('id, first_name, last_name, status, user_id').eq('phone', variant).maybeSingle()
        if (data) { foundTeamMember = data; break }
      }

      let foundTenant = null
      for (const variant of phoneVariants) {
        const { data } = await supabaseAdmin.from('tenants').select('id, full_name, staying_status, phone, organization_id').eq('phone', variant).maybeSingle()
        if (data) { foundTenant = data; break }
      }

      let userType = 'unknown'
      if (foundTeamMember) {
        userType = 'team_member'
        if (foundTeamMember.status !== 'active') {
          return new Response(JSON.stringify({
            error: `Access denied. Your team account is currently "${foundTeamMember.status}".`
          }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
      } else if (foundTenant) {
        userType = 'tenant'
        const tenantStatus = (foundTenant.staying_status || '').toLowerCase()
        if (tenantStatus === 'new') {
          return new Response(JSON.stringify({
            error: 'Your status is "New". You will be able to log in once onboarding is completed.'
          }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        const allowedStatuses = ['staying', 'on-notice', 'booked']
        if (!allowedStatuses.includes(tenantStatus)) {
          return new Response(JSON.stringify({
            error: `Access denied. Your tenant status is "${foundTenant.staying_status || 'unknown'}".`
          }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
      }

      const supabaseClient = createClient(supabaseUrl, anonKey)
      const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers()
      const found = existingUser?.users?.find(u => u.email === email)

      let sessionData = null

      if (found) {
        await supabaseAdmin.auth.admin.updateUserById(found.id, { password })
        const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({ email, password })
        if (signInError) {
          return new Response(JSON.stringify({ error: signInError.message }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        sessionData = signInData
        if (userType === 'tenant' && found.id) {
          await ensureTenantRole(supabaseAdmin, found.id, foundTenant)
        }
      } else {
        const fullName = foundTeamMember
          ? `${foundTeamMember.first_name || ''} ${foundTeamMember.last_name || ''}`.trim()
          : foundTenant?.full_name || ''

        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email, password, email_confirm: true,
          user_metadata: { phone, full_name: fullName }
        })
        if (createError) {
          return new Response(JSON.stringify({ error: createError.message }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const { data: newSession, error: newSignInError } = await supabaseClient.auth.signInWithPassword({ email, password })
        if (newSignInError) {
          return new Response(JSON.stringify({ error: newSignInError.message }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        sessionData = newSession
        if (userType === 'tenant' && newUser?.user?.id) {
          await ensureTenantRole(supabaseAdmin, newUser.user.id, foundTenant)
        }
      }

      await supabaseAdmin.from('otp_codes').delete().eq('phone', cleanPhone);

      return new Response(JSON.stringify({ ...sessionData, user_type: userType }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function ensureTenantRole(supabaseAdmin: any, userId: string, tenant: any) {
  try {
    const { data: existingRole } = await supabaseAdmin
      .from('user_roles').select('id').eq('user_id', userId).eq('role', 'tenant').maybeSingle()

    if (!existingRole) {
      await supabaseAdmin.from('user_roles').insert({ user_id: userId, role: 'tenant' })
    }

    if (tenant?.id) {
      await supabaseAdmin.from('tenants').update({ user_id: userId }).eq('id', tenant.id)
    }

    if (tenant?.organization_id) {
      await supabaseAdmin.from('profiles').update({
        organization_id: tenant.organization_id,
        full_name: tenant.full_name,
        phone: tenant.phone,
      }).eq('id', userId)
    }
  } catch (err) {
    console.error('Error assigning tenant role:', err)
  }
}
