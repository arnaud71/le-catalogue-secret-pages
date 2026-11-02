import { COLORS, createGame } from './game.js';

const NAMES = Object.freeze({ rouge: 'Rouge', bleu: 'Bleu', vert: 'Vert', jaune: 'Jaune', orange: 'Orange', violet: 'Violet' });
const SYMBOLS = Object.freeze({ rouge: 'R', bleu: 'B', vert: 'V', jaune: 'J', orange: 'O', violet: 'Vi' });
const $ = (selector) => document.querySelector(selector);
const slots = [];
const palette = [];
let draft = Array(4).fill(null);
let selected = 0;
let state;
let busy = false;

function makePeg(color) {
  const peg = document.createElement('span');
  peg.className = `peg${color ? ` color-${color}` : ' is-empty'}`;
  peg.setAttribute('aria-hidden', 'true');
  if (color) peg.dataset.color = color;
  const symbol = document.createElement('span');
  symbol.className = 'peg-symbol';
  symbol.textContent = color ? SYMBOLS[color] : '+';
  peg.append(symbol);
  return peg;
}

function selectSlot(index, focus = false) {
  selected = index;
  renderDraft();
  if (focus) slots[selected].focus();
}

function chooseColor(color, focusNext = false) {
  if (busy || state.status !== 'playing') return;
  draft[selected] = color;
  const next = Array.from({ length: 4 }, (_, offset) => (selected + offset + 1) % 4).find((index) => draft[index] === null);
  if (next !== undefined) selected = next;
  renderDraft();
  $('#feedback').className = 'feedback';
  $('#feedback').textContent = draft.every(Boolean)
    ? 'Votre proposition est prête. Vous pouvez la modifier ou la valider.'
    : `Choisissez une couleur pour la position ${selected + 1}.`;
  if (focusNext) slots[selected].focus();
}

for (let index = 0; index < 4; index += 1) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'guess-slot';
  const number = document.createElement('span');
  number.className = 'slot-number';
  number.textContent = String(index + 1).padStart(2, '0');
  const name = document.createElement('span');
  name.className = 'color-name';
  button.append(number, makePeg(null), name);
  button.addEventListener('click', () => selectSlot(index));
  button.addEventListener('keydown', (event) => {
    let target;
    if (event.key === 'ArrowRight') target = (index + 1) % 4;
    if (event.key === 'ArrowLeft') target = (index + 3) % 4;
    if (event.key === 'Home') target = 0;
    if (event.key === 'End') target = 3;
    if (target !== undefined) {
      event.preventDefault();
      selectSlot(target, true);
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      draft[index] = null;
      selected = index;
      renderDraft();
      $('#feedback').className = 'feedback';
      $('#feedback').textContent = `Position ${index + 1} effacée. Choisissez une couleur.`;
    }
    if (/^[1-6]$/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      selected = index;
      chooseColor(COLORS[Number(event.key) - 1], true);
    }
  });
  slots.push(button);
  $('#guess-slots').append(button);
}

for (const [index, color] of COLORS.entries()) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'palette-option';
  button.dataset.color = color;
  button.setAttribute('aria-label', `${NAMES[color]}, touche ${index + 1}`);
  const name = document.createElement('span');
  name.className = 'color-name';
  name.textContent = NAMES[color];
  const key = document.createElement('kbd');
  key.textContent = String(index + 1);
  key.setAttribute('aria-hidden', 'true');
  button.append(makePeg(color), name, key);
  button.addEventListener('click', () => chooseColor(color));
  button.addEventListener('keydown', (event) => {
    if (/^[1-6]$/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      chooseColor(COLORS[Number(event.key) - 1], true);
    }
  });
  palette.push(button);
  $('#color-palette').append(button);
}

function renderDraft() {
  const disabled = busy || state?.status !== 'playing';
  for (const [index, button] of slots.entries()) {
    const color = draft[index];
    if (color) button.dataset.color = color;
    else delete button.dataset.color;
    button.setAttribute('aria-pressed', String(selected === index));
    button.setAttribute('aria-label', `Position ${index + 1} : ${color ? NAMES[color] : 'vide'}`);
    button.querySelector('.peg').replaceWith(makePeg(color));
    button.querySelector('.color-name').textContent = color ? NAMES[color] : 'Choisir';
    button.disabled = disabled;
  }
  for (const button of palette) button.disabled = disabled;
  $('#submit-guess').disabled = disabled;
  $('#clear-guess').disabled = disabled || draft.every((color) => color === null);
  $('#selection-hint').textContent = `Pour la position ${selected + 1}`;
}

function renderHistory(history) {
  const fragment = document.createDocumentFragment();
  for (const [index, entry] of history.entries()) {
    const row = document.createElement('tr');
    const number = document.createElement('th');
    number.scope = 'row';
    number.textContent = String(index + 1).padStart(2, '0');
    const proposal = document.createElement('td');
    const pegs = document.createElement('div');
    pegs.className = 'history-pegs';
    for (const color of entry.guess) {
      const item = document.createElement('span');
      item.className = 'history-peg';
      const name = document.createElement('span');
      name.className = 'color-name';
      name.textContent = NAMES[color];
      item.append(makePeg(color), name);
      pegs.append(item);
    }
    proposal.append(pegs);
    const wellPlaced = document.createElement('td');
    wellPlaced.className = 'well-placed';
    wellPlaced.textContent = String(entry.result.wellPlaced);
    const misplaced = document.createElement('td');
    misplaced.className = 'misplaced';
    misplaced.textContent = String(entry.result.misplaced);
    row.append(number, proposal, wellPlaced, misplaced);
    fragment.append(row);
  }
  $('#history-body').replaceChildren(fragment);
  $('#history-empty').hidden = history.length !== 0;
  $('#history-table-wrapper').hidden = history.length === 0;
}

function renderState(next, action) {
  state = next;
  if (action === 'start' || action === 'guess') {
    draft = Array(4).fill(null);
    selected = 0;
  }
  const finished = next.status === 'won' || next.status === 'lost';
  $('.game-card').classList.toggle('is-finished', finished);
  $('#game-status').textContent = ({ 'not-started': 'Prêt à jouer', playing: 'À vous de jouer', won: 'Code retrouvé', lost: 'Partie terminée' })[next.status];
  $('#attempt-count').textContent = `${next.attempts} essai${next.attempts > 1 ? 's' : ''} sur 10`;
  const remaining = 10 - next.attempts;
  $('#remaining-count').textContent = `${remaining} essai${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''}`;
  $('#proposal-number').textContent = `Essai ${Math.min(next.attempts + 1, 10)}`;
  $('#composer').hidden = finished;
  $('#game-result').hidden = !finished;
  if (finished) {
    $('#result-eyebrow').textContent = next.status === 'won' ? 'RECHERCHE ABOUTIE' : 'FIN DU REGISTRE';
    $('#result-title').textContent = next.status === 'won' ? 'Vous avez trouvé le code !' : 'Les dix essais sont écoulés.';
    $('#result-message').textContent = next.status === 'won'
      ? `Bravo ! ${next.attempts} essai${next.attempts > 1 ? 's' : ''} vous ${next.attempts > 1 ? 'ont' : 'a'} suffi pour retrouver les quatre couleurs dans le bon ordre.`
      : 'Le code reste secret. Votre historique est conservé pour relire les indices. Une nouvelle recherche vous attend.';
  }
  renderHistory(next.history);
  const feedback = $('#feedback');
  feedback.className = `feedback${next.lastError && !finished ? ' is-error' : ''}`;
  if (next.lastError && !finished) feedback.textContent = next.lastError.message;
  else if (next.status === 'not-started') feedback.textContent = 'Commencez une nouvelle partie pour jouer.';
  else if (finished) feedback.textContent = next.status === 'won' ? 'Bravo, vous avez trouvé le code !' : 'Partie terminée après dix essais.';
  else if (next.lastResult) feedback.textContent = `Essai ${next.attempts} : ${next.lastResult.wellPlaced} bien placée${next.lastResult.wellPlaced > 1 ? 's' : ''}, ${next.lastResult.misplaced} mal placée${next.lastResult.misplaced > 1 ? 's' : ''}. Composez votre prochain essai.`;
  else feedback.textContent = 'Choisissez une couleur pour chacune des quatre positions.';
  renderDraft();
}

// One engine owns the game. Both the visible controls and the test API use it.
const game = createGame(renderState);
renderState(game.getState());

async function startNewGame() {
  if (busy) return;
  busy = true;
  $('#new-game').disabled = true;
  try {
    await game.startGame();
  } finally {
    busy = false;
    $('#new-game').disabled = false;
    renderDraft();
  }
  slots[0].focus({ preventScroll: true });
}

$('#new-game').addEventListener('click', startNewGame);
$('#play-again').addEventListener('click', startNewGame);
$('#rules-link').addEventListener('click', () => $('#rules').focus({ preventScroll: true }));
$('#clear-guess').addEventListener('click', () => {
  draft = Array(4).fill(null);
  selected = 0;
  renderDraft();
  $('#feedback').className = 'feedback';
  $('#feedback').textContent = 'Proposition effacée. Choisissez quatre couleurs.';
  slots[0].focus();
});
$('#guess-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy || state.status !== 'playing') return;
  busy = true;
  renderDraft();
  try {
    // Empty UI positions become an incomplete dense guess, handled by the engine.
    await game.submitGuess(draft.filter((color) => color !== null));
  } finally {
    busy = false;
    renderDraft();
  }
  if (state.status === 'playing') slots[selected].focus({ preventScroll: true });
  else $('#play-again').focus({ preventScroll: true });
});

if (new URLSearchParams(location.search).get('test') === '1') {
  window.codeSecretTest = Object.freeze({
    version: game.version,
    getConfig: game.getConfig,
    getState: game.getState,
    startGame: game.startGame,
    submitGuess: game.submitGuess,
  });
} else {
  await game.startGame();
}
