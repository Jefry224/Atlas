// Request ownership for the dossier workspace, independent of DOM and providers.
// Aborting saves work; identity checks also protect against transports ignoring abort.
export function createDossierSession({ loadContext, generateDossier, onChange = () => {} }) {
  let revision = 0, loadController = null, generation = null;
  let state = Object.freeze({ scenario: null, context: null, dossier: null, loading: false, busy: false, error: null, errorStage: null });
  const update = patch => { state = Object.freeze({ ...state, ...patch }); onChange(state); };
  const currentGeneration = request => generation === request && revision === request.revision;

  async function select(scenario) {
    const selectedRevision = ++revision;
    loadController?.abort(); generation?.controller.abort(); generation = null;
    const selected = scenario ? structuredClone(scenario) : null;
    const controller = new AbortController(); loadController = controller;
    update({ scenario: selected, context: null, dossier: null, loading: Boolean(selected), busy: false, error: null, errorStage: null });
    if (!selected) return false;
    try {
      const context = await loadContext(selected, { signal: controller.signal });
      if (revision !== selectedRevision) return false;
      if (context?.scenario?.id !== selected.id || context?.earth?.id !== selected.earthId || context?.target?.id !== selected.targetId) {
        throw new Error('Loaded evidence does not match the selected scenario.');
      }
      update({ context: structuredClone(context), loading: false });
      return true;
    } catch (error) {
      if (revision !== selectedRevision) return false;
      controller.abort();
      update({ context: null, loading: false, error, errorStage: 'load' });
      return false;
    } finally {
      if (revision === selectedRevision) loadController = null;
    }
  }

  async function generate() {
    if (state.loading || state.busy || !state.context || state.context.scenario.id !== state.scenario?.id) return false;
    const request = { revision, scenarioId: state.scenario.id, controller: new AbortController() };
    const context = structuredClone(state.context);
    generation = request;
    update({ busy: true, error: null, errorStage: null });
    try {
      const result = await generateDossier(context, { signal: request.controller.signal });
      if (!currentGeneration(request)) return false;
      if (typeof result?.markdown !== 'string' || !result.markdown.trim()) throw new Error('The provider returned an empty dossier.');
      update({ dossier: { ...structuredClone(result), scenarioId: request.scenarioId } });
      return true;
    } catch (error) {
      if (currentGeneration(request)) update({ error, errorStage: 'generate' });
      return false;
    } finally {
      if (currentGeneration(request)) { generation = null; update({ busy: false }); }
    }
  }

  return { select, generate, get state() { return state; } };
}

export function dossierModuleAvailability(context) {
  return { audit: context?.analogyAudit?.valid === true, processes: Boolean(context?.processes) };
}
