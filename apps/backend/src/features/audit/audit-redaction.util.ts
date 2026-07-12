export function maskEmailAddress(email: string): string {
  const normalized = email.trim().toLowerCase();
  const [localPart, domain] = normalized.split('@');

  if (!localPart || !domain) {
    return '***';
  }

  const visiblePrefix = localPart.slice(0, Math.min(2, localPart.length));
  return `${visiblePrefix}***@${domain}`;
}

export function truncateForAudit(value: string | undefined, maxLength: number): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.length > maxLength ? value.slice(0, maxLength) : value;
}
