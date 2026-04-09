export type CutOptionSettings = {
  showFrontShoulderSteaks: boolean;
  showSteakThickness: boolean;
  showBackstrapThickness: boolean;
  showRoastCounts: boolean;
};

export function normalizeCutOptionSettings(raw: any): CutOptionSettings {
  return {
    showFrontShoulderSteaks: raw?.showFrontShoulderSteaks !== false,
    showSteakThickness: raw?.showSteakThickness !== false,
    showBackstrapThickness: raw?.showBackstrapThickness !== false,
    showRoastCounts: raw?.showRoastCounts !== false,
  };
}
