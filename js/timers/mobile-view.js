// Mobile team tabs — lets a phone user flip between agendas without the
// active timer's team changing (that only changes via selectBlock).
const courtroomBody = document.getElementById('courtroom-body');
const mobileTabLeft = document.getElementById('tab-left');
const mobileTabRight = document.getElementById('tab-right');

export function setMobileView(team) {
    courtroomBody.dataset.mobileView = team;
    mobileTabLeft.classList.toggle('active', team === 'left');
    mobileTabRight.classList.toggle('active', team === 'right');
}

mobileTabLeft.addEventListener('click', () => setMobileView('left'));
mobileTabRight.addEventListener('click', () => setMobileView('right'));

export function initMobileTabLabels(leftTeamName, rightTeamName) {
    mobileTabLeft.textContent = leftTeamName;
    mobileTabRight.textContent = rightTeamName;
}
