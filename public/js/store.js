// Shared client-side state — the server bundle from buildState().
export const state = { current: null };

export function setState(s) { state.current = s; }

export function getState() { return state.current; }

export function getCredits() {
  return state.current ? state.current.user.credits : 0;
}

// Mutating routes return a fresh state bundle — either directly or as a
// `state` property alongside a payload (e.g. test submit returns {result, state}).
export function adoptState(response) {
  if (!response) return;
  if (response.state) setState(response.state);
  else if (response.user && response.subjects) setState(response);
}
