/** Rules shared by the visible game and the public test API (contract 0.2). */
export const COLORS = Object.freeze(['rouge', 'bleu', 'vert', 'jaune', 'orange', 'violet']);

const SECRET_LENGTH = 4;
const MAX_ATTEMPTS = 10;
const copy = value => structuredClone(value);
const messages = {
  'invalid-options': 'Les options doivent être un objet contenant uniquement un éventuel secret.',
  'invalid-type': 'Choisissez un tableau complet de noms de couleurs.',
  'invalid-length': 'Votre proposition doit contenir exactement quatre couleurs.',
  'invalid-color': 'La couleur proposée n’est pas autorisée.',
  'game-not-started': 'Démarrez une nouvelle partie pour jouer.',
  'game-finished': 'Cette partie est terminée. Démarrez une nouvelle partie.'
};

// Presence and element types have priority over length, then allowed values.
function validateColors(value) {
  if (!Array.isArray(value)) return 'invalid-type';
  for (let i = 0; i < value.length; i++) {
    if (!Object.hasOwn(value, i) || typeof value[i] !== 'string') return 'invalid-type';
  }
  if (value.length !== SECRET_LENGTH) return 'invalid-length';
  if (value.some(color => !COLORS.includes(color))) return 'invalid-color';
  return null;
}

function isOrdinaryObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  // Direct equality with this window's Object.prototype rejects parent-window tests.
  return prototype !== null
    && Object.hasOwn(prototype, 'constructor')
    && typeof prototype.constructor === 'function'
    && Function.prototype.toString.call(prototype.constructor) === Function.prototype.toString.call(Object);
}

/** Count exact matches before considering remaining occurrences (valid codes only). */
export function score(secret, guess) {
  let wellPlaced = 0;
  const remainingSecret = new Map();
  const remainingGuess = new Map();
  for (let i = 0; i < SECRET_LENGTH; i++) {
    if (secret[i] === guess[i]) {
      wellPlaced++;
    } else {
      remainingSecret.set(secret[i], (remainingSecret.get(secret[i]) ?? 0) + 1);
      remainingGuess.set(guess[i], (remainingGuess.get(guess[i]) ?? 0) + 1);
    }
  }
  const misplaced = COLORS.reduce((total, color) => total + Math.min(
    remainingSecret.get(color) ?? 0,
    remainingGuess.get(color) ?? 0
  ), 0);
  return { wellPlaced, misplaced };
}

const emptyState = status => ({
  status, attempts: 0, history: [], lastGuess: null, lastResult: null, lastError: null
});

/**
 * The secret stays in this closure. onChange receives an independent snapshot
 * and a 'start', 'guess' or 'error' action so the UI can reset its draft;
 * mutations resolve after its optional asynchronous rendering has completed.
 */
export function createGame(onChange = () => {}) {
  let secret = null;
  let state = emptyState('not-started');

  const getState = () => copy(state);
  const getConfig = () => ({
    apiVersion: '0.2', rulesVersion: 'code-couleurs-1.0',
    secretLength: SECRET_LENGTH, maxAttempts: MAX_ATTEMPTS,
    allowDuplicates: true, colors: [...COLORS]
  });

  async function notify(action) {
    const snapshot = getState();
    await onChange(copy(snapshot), action);
    return snapshot;
  }

  async function startGame(options = {}) {
    let error = !isOrdinaryObject(options)
      || Reflect.ownKeys(options).some(key => key !== 'secret')
      ? 'invalid-options' : null;
    const imposed = !error && Object.hasOwn(options, 'secret');
    if (!error && imposed) error = validateColors(options.secret);
    // No mutation or notification on failure, including the previous lastError.
    if (error) throw Object.assign(new Error(messages[error]), { code: error });

    secret = imposed ? [...options.secret] : Array.from({ length: SECRET_LENGTH },
      () => COLORS[Math.floor(Math.random() * COLORS.length)]);
    state = emptyState('playing');
    return notify('start');
  }

  async function submitGuess(guess) {
    const error = state.status === 'not-started' ? 'game-not-started'
      : state.status !== 'playing' ? 'game-finished' : validateColors(guess);
    if (error) {
      state.lastError = { code: error, message: messages[error] };
      return notify('error');
    }

    const result = score(secret, guess);
    state.history.push({ guess: [...guess], result });
    state.attempts++;
    state.lastGuess = [...guess];
    state.lastResult = result;
    state.lastError = null;
    // A correct tenth guess wins before the attempt limit is considered.
    state.status = result.wellPlaced === SECRET_LENGTH ? 'won'
      : state.attempts === MAX_ATTEMPTS ? 'lost' : 'playing';
    return notify('guess');
  }

  return Object.freeze({ version: '0.2', getConfig, getState, startGame, submitGuess });
}
