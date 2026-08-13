export const ROLES = {
  ADMIN: 'ADMIN',
  QUALITY: 'QUALITY',
  MAINTENANCE: 'MAINTENANCE',
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

export const ANALYSIS_ROLES: AppRole[] = [ROLES.ADMIN, ROLES.QUALITY, ROLES.MAINTENANCE];
export const QUALITY_ROLES: AppRole[] = [ROLES.ADMIN, ROLES.QUALITY];
