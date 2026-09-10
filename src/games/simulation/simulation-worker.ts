import type { CasinoAdminSettings } from "../../data/casino-admin";
import { runCasinoSimulation, type CasinoSimulationReport, type CasinoSimulationRequest } from "./casino-simulation-engine";
import { researchSimulation, validateSimulationSelection, type OptimizationChange, type SimulationOptimizationGoal } from "./simulation-optimizer";

export type SimulationWorkerRequest = {
  request: CasinoSimulationRequest;
  settings: CasinoAdminSettings;
  goal?: SimulationOptimizationGoal;
  report?: CasinoSimulationReport;
  selectedChanges?: OptimizationChange[];
};

self.onmessage = async (event: MessageEvent<SimulationWorkerRequest>) => {
  try {
    const { request, settings, goal } = event.data;
    if (event.data.selectedChanges && goal) {
      const recommendation = await validateSimulationSelection(request, settings, goal, event.data.selectedChanges, progress => self.postMessage({ type: "progress", progress }));
      self.postMessage({ type: "selection", recommendation });
      self.postMessage({ type: "done" });
      return;
    }
    const report = event.data.report ?? runCasinoSimulation(request, settings);
    self.postMessage({ type: "report", report });
    if (goal) {
      const research = await researchSimulation(report, settings, goal, progress => self.postMessage({ type: "progress", progress }));
      self.postMessage({ type: "research", research });
    }
    self.postMessage({ type: "done" });
  } catch (error) {
    self.postMessage({ type: "error", error: error instanceof Error ? error.message : String(error) });
  }
};
