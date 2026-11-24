// Installation is optional; the game always remains playable in the browser.
const card = document.querySelector('#install-card');
const button = document.querySelector('#install-game');
const help = document.querySelector('#install-help');
const standalone = window.matchMedia('(display-mode: standalone)');
let pendingPrompt;
let installed = false;

function updateVisibility() {
  card.hidden = installed || standalone.matches || navigator.standalone === true;
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  pendingPrompt = event;
});

window.addEventListener('appinstalled', () => {
  installed = true;
  pendingPrompt = undefined;
  help.close();
  updateVisibility();
});

button.addEventListener('click', async () => {
  if (!pendingPrompt) {
    help.showModal();
    return;
  }
  // A native prompt can be used only once, following an explicit user click.
  const prompt = pendingPrompt;
  pendingPrompt = undefined;
  button.disabled = true;
  try {
    await prompt.prompt();
  } catch {
    help.showModal();
  } finally {
    button.disabled = false;
  }
});

standalone.addEventListener('change', updateVisibility);
updateVisibility();
