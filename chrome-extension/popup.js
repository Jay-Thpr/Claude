const API_BASE = 'http://localhost:3000';

function showState(id) {
  ['state-loading', 'state-loaded', 'state-error'].forEach(s => {
    document.getElementById(s).classList.add('hidden');
  });
  document.getElementById(id).classList.remove('hidden');
}

function renderAppointment(data) {
  const appt = data.appointment;

  if (!appt) {
    // Connected but no upcoming appointments
    document.getElementById('appt-summary').textContent = 'No upcoming appointments found.';
    document.getElementById('appt-when').textContent = '';
    showState('state-loaded');
    return;
  }

  document.getElementById('appt-summary').textContent = appt.summary || 'Appointment';

  const when = [appt.whenLabel, appt.timeLabel].filter(Boolean).join(' at ');
  document.getElementById('appt-when').textContent = when;

  const locationEl = document.getElementById('appt-location');
  if (appt.location) {
    locationEl.textContent = appt.location;
    locationEl.classList.remove('hidden');
  }

  const prepBlock = document.getElementById('prep-block');
  const prepEl = document.getElementById('appt-prep');
  if (data.prep_advice) {
    prepEl.textContent = data.prep_advice;
    prepBlock.classList.remove('hidden');
  }

  showState('state-loaded');
}

document.addEventListener('DOMContentLoaded', () => {
  showState('state-loading');

  fetch(`${API_BASE}/api/appointments`)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => renderAppointment(data))
    .catch(() => showState('state-error'));
});
