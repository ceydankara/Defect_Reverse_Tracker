export const ROLES = {
  ADMIN: 'ADMIN',
  QUALITY: 'QUALITY',
  MAINTENANCE: 'MAINTENANCE',
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<AppRole, string> = {
  [ROLES.ADMIN]: 'Yönetici',
  [ROLES.QUALITY]: 'Kalite Kontrol',
  [ROLES.MAINTENANCE]: 'Bakım / Üretim',
};

/** Hasar analizi ekranı */
export const ANALYSIS_ROLES: AppRole[] = [ROLES.ADMIN, ROLES.QUALITY, ROLES.MAINTENANCE];
/** Kalite sınıflandırma ve karar verme */
export const QUALITY_ROLES: AppRole[] = [ROLES.ADMIN, ROLES.QUALITY];
