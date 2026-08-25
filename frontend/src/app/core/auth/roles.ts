export const ROLES = {
  ADMIN: 'ADMIN',
  QUALITY: 'QUALITY',
  MAINTENANCE: 'MAINTENANCE',
  SALES: 'SALES',
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<AppRole, string> = {
  [ROLES.ADMIN]: 'Yönetici',
  [ROLES.QUALITY]: 'Kalite Kontrol',
  [ROLES.MAINTENANCE]: 'Bakım / Üretim',
  [ROLES.SALES]: 'Satış / Müşteri İlişkileri',
};

/** Hasar analizi ekranı ve ana panelde son talepler */
export const ANALYSIS_ROLES: AppRole[] = [ROLES.ADMIN, ROLES.QUALITY, ROLES.MAINTENANCE];
/** Fabrika kalite kuyruğu ve karar verme */
export const QUALITY_ROLES: AppRole[] = [ROLES.ADMIN, ROLES.QUALITY];
/** Müşteri şikâyet dosyaları — kalite personeli giremez */
export const FIELD_CASE_ROLES: AppRole[] = [ROLES.ADMIN, ROLES.SALES];

export function formatInspectorName(jobTitle?: string | null, fullName?: string | null): string {
  const title = jobTitle?.trim() ?? '';
  const name = fullName?.trim() ?? '';
  if (title && name) return `${title} ${name}`;
  return name || title || 'Kalite Kontrol';
}
