const readyChoiceTypes = {
  'Психолог - готовий лендінг': 'landing',
  'Фотограф - готовий сайт-візитка': 'business_card',
  'Масажист - готовий лендінг': 'landing',
};

function applyReadyChoice(value) {
  const choice = document.getElementById('ready-choice');
  if (choice) choice.value = value;
  document.body.dataset.serviceType = readyChoiceTypes[value] || 'landing';
}

document.querySelectorAll('[data-ready-choice]').forEach(button => {
  button.addEventListener('click', () => {
    const value = button.dataset.readyChoice || '';
    applyReadyChoice(value);
    const choice = document.getElementById('ready-choice');
    document.getElementById('brief')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => choice?.focus(), 500);
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'select_item', {
        item_list_name: 'ready_sites',
        item_name: button.dataset.readyChoice || '',
      });
    }
  });
});

const templateChoices = {
  psychologist: 'Психолог - готовий лендінг',
  photographer: 'Фотограф - готовий сайт-візитка',
  massage: 'Масажист - готовий лендінг',
};
const requestedTemplate = new URLSearchParams(window.location.search).get('template');
const requestedChoice = templateChoices[requestedTemplate];
if (requestedChoice) {
  applyReadyChoice(requestedChoice);
}

document.getElementById('ready-choice')?.addEventListener('change', event => {
  applyReadyChoice(event.currentTarget.value);
});
