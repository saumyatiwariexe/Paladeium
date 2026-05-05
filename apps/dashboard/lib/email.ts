const FROM = process.env.RESEND_FROM ?? 'Paladeium <onboarding@resend.dev>'

function inviteHtml(inviteUrl: string, role: string, restaurantName?: string): string {
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1)
  const context   = restaurantName ? ` to manage <strong>${restaurantName}</strong>` : ' to Paladeium'

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0B0C10;font-family:system-ui,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#13151E;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.07);">
    <div style="background:#7C5CFC;padding:32px 40px 28px;">
      <div style="color:#fff;font-size:22px;font-weight:900;letter-spacing:-0.5px;">Paladeium</div>
      <div style="color:rgba(255,255,255,0.7);font-size:13px;margin-top:4px;">AR Restaurant Platform</div>
    </div>
    <div style="padding:36px 40px;">
      <h2 style="color:#E8EAFF;font-size:20px;font-weight:800;margin:0 0 12px;">You're invited${context}</h2>
      <p style="color:#8B90B0;font-size:14px;line-height:1.6;margin:0 0 28px;">
        You've been added as a <strong style="color:#E8EAFF;">${roleLabel}</strong>.
        Click the button below to set your password and get started.
        This link expires in <strong style="color:#E8EAFF;">72 hours</strong>.
      </p>
      <a href="${inviteUrl}"
         style="display:inline-block;background:#7C5CFC;color:#fff;font-weight:700;font-size:14px;padding:14px 28px;border-radius:10px;text-decoration:none;">
        Accept Invitation →
      </a>
      <p style="color:#4B4F65;font-size:12px;margin-top:28px;word-break:break-all;">
        Or copy this link: ${inviteUrl}
      </p>
    </div>
  </div>
</body>
</html>`
}

export async function sendInviteEmail(
  to: string,
  inviteUrl: string,
  role: string,
  restaurantName?: string,
): Promise<void> {
  const key = process.env.RESEND_API_KEY

  if (!key) {
    // Dev fallback — log to console so the invite can be used manually
    console.log('\n─── INVITE LINK (RESEND_API_KEY not set) ───')
    console.log(`To:  ${to}`)
    console.log(`URL: ${inviteUrl}`)
    console.log('────────────────────────────────────────────\n')
    return
  }

  const roleLabel     = role.charAt(0).toUpperCase() + role.slice(1)
  const subject       = restaurantName
    ? `${roleLabel} invite for ${restaurantName} — Paladeium`
    : `You're invited to Paladeium`

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body:    JSON.stringify({ from: FROM, to, subject, html: inviteHtml(inviteUrl, role, restaurantName) }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(`Email failed: ${err.message ?? res.statusText}`)
  }
}
