const TITLES = {
  dashboard: 'Dashboard', subjects: 'Subjects', tests: 'Tests', ai: 'AI Teacher',
  tasks: 'Tasks', notes: 'Notes', progress: 'Progress',
  achievements: 'Achievements', timetable: 'Time Table',
};

export function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(page);
  if (el) el.classList.add('active');
  document.querySelectorAll('.nav button').forEach(b => {
    b.classList.toggle('active', b.dataset.page === page);
  });
  document.getElementById('pageTitle').textContent = TITLES[page] || page;
  window.scrollTo(0, 0);
}
