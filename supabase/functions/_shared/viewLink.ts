// The view-link email-domain gate, shared by the two unauthenticated
// view-link functions (get-view-project, set-view-scale), which carried
// byte-identical copies before this. Default domain overridable via the
// VIEW_LINK_ALLOWED_DOMAINS function secret (comma-separated).
export function getAllowedDomains(): string[] {
  const raw = Deno.env.get('VIEW_LINK_ALLOWED_DOMAINS') || 'clickplumbing.com'
  return raw.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean)
}

export function emailDomainAllowed(email: string, allowedDomains: string[]): boolean {
  const addr = String(email).trim().toLowerCase()
  const at = addr.lastIndexOf('@')
  if (at < 0) return false
  const domain = addr.slice(at + 1)
  return allowedDomains.some((d) => domain === d || domain.endsWith('.' + d))
}
