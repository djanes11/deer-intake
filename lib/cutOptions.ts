export type CutOptionSettings = {
  showFrontShoulderSteaks: boolean;
  showBackstrapThickness: boolean;
  showRoastCounts: boolean;
};

export function normalizeCutOptionSettings(raw: any): CutOptionSettings {
  return {
    showFrontShoulderSteaks: raw?.showFrontShoulderSteaks !== false,
    showBackstrapThickness: raw?.showBackstrapThickness !== false,
    showRoastCounts: raw?.showRoastCounts !== false,
  };
}
