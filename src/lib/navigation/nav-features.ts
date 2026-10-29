export const navFeatureAvailability = {
  mercados: true,
} as const;

export function isMercadosNavEnabled() {
  return navFeatureAvailability.mercados;
}
