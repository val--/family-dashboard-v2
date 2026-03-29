export const mockPrinter = {
  name: 'Deskjet_3630',
  connected: true,
  status: 'idle',
  ink: null,
}

export const mockCalendar = {
  events: [
    { title: 'Réunion parents', start: futureDate(1, '18:00'), end: futureDate(1, '19:00'), allDay: false },
    { title: 'Dentiste Emma', start: futureDate(3, '10:30'), end: futureDate(3, '11:00'), allDay: false },
    { title: 'Vacances scolaires', start: futureDate(7), end: futureDate(14), allDay: true },
    { title: 'Anniversaire Léo', start: futureDate(12, '14:00'), end: futureDate(12, '18:00'), allDay: false },
    { title: 'Concert', start: futureDate(20, '20:00'), end: futureDate(20, '23:00'), allDay: false },
  ],
}

export const mockPlex = {
  movies: [
    { title: 'Interstellar', year: '2014', addedAt: String(Math.floor(Date.now() / 1000) - 86400), thumb: null },
    { title: 'Amélie Poulain', year: '2001', addedAt: String(Math.floor(Date.now() / 1000) - 172800), thumb: null },
    { title: 'Spirited Away', year: '2001', addedAt: String(Math.floor(Date.now() / 1000) - 259200), thumb: null },
    { title: 'The Grand Budapest Hotel', year: '2014', addedAt: String(Math.floor(Date.now() / 1000) - 604800), thumb: null },
  ],
}

function futureDate(daysFromNow, time) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  if (time) {
    const [h, m] = time.split(':')
    d.setHours(parseInt(h), parseInt(m), 0, 0)
    return d.toISOString()
  }
  return d.toISOString().slice(0, 10)
}
