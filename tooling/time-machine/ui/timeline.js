// Run before timeline-cart.js captures the last card. Navigation creates a clean
// cart instance instead of leaving observers attached to a reordered timeline.
const order = new URLSearchParams(location.search).get('order') === 'oldest' ? 'oldest' : 'newest';
const timeline = document.querySelector('.timeline');
if (timeline) {
  const cards = [...timeline.querySelectorAll('.moment')];
  cards.sort((a,b) => (order === 'oldest' ? 1 : -1) * a.dataset.date.localeCompare(b.dataset.date));
  for (const [index, card] of cards.entries()) {
    card.classList.toggle('moment--flip', index % 2 === 1);
    timeline.append(card);
  }
}
for (const link of document.querySelectorAll('[data-order]')) {
  if (link.dataset.order === order) link.setAttribute('aria-current', 'true');
  else link.removeAttribute('aria-current');
}
