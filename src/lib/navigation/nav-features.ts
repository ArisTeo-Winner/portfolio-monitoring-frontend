export const navFeatureAvailability = {
  mercados: false,
} as const;

export function isMercadosNavEnabled() {
  return navFeatureAvailability.mercados;
}
