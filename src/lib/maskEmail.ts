// Mask an email for display in the "we sent a confirmation link to …" message,
// so the page never echoes the full address back to whoever opened the link
// (which may be a forward recipient). Keeps the first character and the domain:
//   jordan@acme.com   -> j***@acme.com
//   k@acme.com        -> *@acme.com
//   not-an-email      -> ***  (defensive; we never expect this)
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = local.length > 1 ? local[0] : '';
  return `${head}***@${domain}`;
}
