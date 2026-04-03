export const mockVpn = {
  healthy: true,
  ip: '185.230.126.42',
  country: 'FR',
  city: 'Paris',
  org: 'AS9009 M247 Ltd',
}

export const mockPrinter = {
  name: 'Deskjet_3630',
  connected: true,
  status: 'idle',
  ink: null,
}

export const mockCalendar = {
  events: [
    { title: 'Réunion parents', start: futureDate(1, '18:00'), end: futureDate(1, '19:00'), allDay: false },
    { title: 'Cours de piano', start: futureDate(1, '14:00'), end: futureDate(1, '15:00'), allDay: false },
    { title: 'Dentiste Emma', start: futureDate(3, '10:30'), end: futureDate(3, '11:00'), allDay: false },
    { title: 'Piscine', start: futureDate(4, '16:00'), end: futureDate(4, '17:30'), allDay: false },
    { title: 'Vacances scolaires', start: futureDate(7), end: futureDate(14), allDay: true },
    { title: 'Brunch chez Marie', start: futureDate(8, '11:00'), end: futureDate(8, '14:00'), allDay: false },
    { title: 'Anniversaire Léo', start: futureDate(12, '14:00'), end: futureDate(12, '18:00'), allDay: false },
    { title: 'Pédiatre', start: futureDate(15, '09:00'), end: futureDate(15, '09:30'), allDay: false },
    { title: 'Dîner chez les voisins', start: futureDate(17, '19:30'), end: futureDate(17, '23:00'), allDay: false },
    { title: 'Concert', start: futureDate(20, '20:00'), end: futureDate(20, '23:00'), allDay: false },
    { title: 'Cinéma en famille', start: futureDate(22, '14:00'), end: futureDate(22, '16:30'), allDay: false },
    { title: 'Fête de l\'école', start: futureDate(25), end: futureDate(25), allDay: true },
    { title: 'Coiffeur Julie', start: futureDate(27, '10:00'), end: futureDate(27, '11:00'), allDay: false },
    { title: 'Week-end camping', start: futureDate(30), end: futureDate(32), allDay: true },
    { title: 'Réunion de quartier', start: futureDate(35, '18:30'), end: futureDate(35, '20:00'), allDay: false },
    { title: 'Spectacle de danse', start: futureDate(40, '19:00'), end: futureDate(40, '21:00'), allDay: false },
  ],
}

export const mockPlex = {
  movies: [
    { title: 'Interstellar', year: '2014', addedAt: String(Math.floor(Date.now() / 1000) - 86400), thumb: null, watched: true, summary: 'Les aventures d\'un groupe d\'explorateurs...', rating: '8.7', duration: 169, genres: ['Science-Fiction', 'Drame'], directors: ['Christopher Nolan'], actors: ['Matthew McConaughey', 'Anne Hathaway'] },
    { title: 'Amélie Poulain', year: '2001', addedAt: String(Math.floor(Date.now() / 1000) - 172800), thumb: null, watched: false, summary: 'Amélie, une jeune serveuse dans un bar de Montmartre, découvre un petit trésor caché et décide de le rendre à son propriétaire.', rating: '8.3', duration: 122, genres: ['Comédie', 'Romance'], directors: ['Jean-Pierre Jeunet'], actors: ['Audrey Tautou', 'Mathieu Kassovitz'] },
    { title: 'Spirited Away', year: '2001', addedAt: String(Math.floor(Date.now() / 1000) - 259200), thumb: null, watched: true },
    { title: 'The Grand Budapest Hotel', year: '2014', addedAt: String(Math.floor(Date.now() / 1000) - 604800), thumb: null, watched: false },
    { title: 'Parasite', year: '2019', addedAt: String(Math.floor(Date.now() / 1000) - 700000), thumb: null, watched: true },
    { title: 'Drive', year: '2011', addedAt: String(Math.floor(Date.now() / 1000) - 800000), thumb: null, watched: false },
    { title: 'Blade Runner 2049', year: '2017', addedAt: String(Math.floor(Date.now() / 1000) - 900000), thumb: null, watched: true },
    { title: 'Moonlight', year: '2016', addedAt: String(Math.floor(Date.now() / 1000) - 1000000), thumb: null, watched: false },
    { title: 'La Haine', year: '1995', addedAt: String(Math.floor(Date.now() / 1000) - 1100000), thumb: null, watched: true },
    { title: 'Portrait de la jeune fille en feu', year: '2019', addedAt: String(Math.floor(Date.now() / 1000) - 1200000), thumb: null, watched: false },
    { title: 'Whiplash', year: '2014', addedAt: String(Math.floor(Date.now() / 1000) - 1300000), thumb: null, watched: true },
    { title: 'Her', year: '2013', addedAt: String(Math.floor(Date.now() / 1000) - 1400000), thumb: null, watched: false },
  ],
}

export const mockPlexOnDeck = {
  shows: [
    { show: 'Severance', season: 2, watched: 7, total: 10, thumb: null, nextEpisode: 'Cold Harbor', nextIndex: 8 },
    { show: 'The Bear', season: 3, watched: 4, total: 10, thumb: null, nextEpisode: 'Napkins', nextIndex: 5 },
    { show: 'Shogun', season: 1, watched: 2, total: 10, thumb: null, nextEpisode: 'Servants of Two Masters', nextIndex: 3 },
    { show: 'Fallout', season: 1, watched: 5, total: 8, thumb: null, nextEpisode: 'The Trap', nextIndex: 6 },
    { show: 'Slow Horses', season: 4, watched: 3, total: 6, thumb: null, nextEpisode: 'Returns', nextIndex: 4 },
  ],
}

export const mockPlexShows = {
  shows: [
    { show: 'Severance', season: 2, episode: 10, title: 'Cold Harbor', addedAt: String(Math.floor(Date.now() / 1000) - 43200), thumb: null, watched: false, episodes: 3, genres: ['Thriller', 'Science-Fiction'], contentRating: 'TV-MA', rating: '8.9', summary: 'Mark mène une équipe de bureau dont les souvenirs ont été chirurgicalement divisés entre leur vie professionnelle et personnelle.' },
    { show: 'The Bear', season: 3, episode: 8, title: 'Ice Chips', addedAt: String(Math.floor(Date.now() / 1000) - 172800), thumb: null, watched: true, episodes: 2, genres: ['Drame', 'Comédie'], contentRating: 'TV-MA', rating: '8.6' },
    { show: 'Shogun', season: 1, episode: 5, title: 'Broken to the Fist', addedAt: String(Math.floor(Date.now() / 1000) - 345600), thumb: null, watched: false, episodes: 5, genres: ['Drame', 'Historique'], contentRating: 'TV-MA', rating: '8.7' },
    { show: 'Fallout', season: 1, episode: 3, title: 'The Head', addedAt: String(Math.floor(Date.now() / 1000) - 518400), thumb: null, watched: true, episodes: 3, genres: ['Science-Fiction', 'Action'], contentRating: 'TV-MA', rating: '8.4' },
    { show: 'Slow Horses', season: 4, episode: 6, title: 'Returns', addedAt: String(Math.floor(Date.now() / 1000) - 691200), thumb: null, watched: false, episodes: 1, genres: ['Thriller', 'Espionnage'], contentRating: 'TV-MA', rating: '8.2' },
    { show: 'Ripley', season: 1, episode: 8, title: 'Finale', addedAt: String(Math.floor(Date.now() / 1000) - 864000), thumb: null, watched: true, episodes: 8, genres: ['Thriller', 'Drame'], contentRating: 'TV-MA', rating: '7.9' },
    { show: 'True Detective', season: 4, episode: 4, title: 'Part 4', addedAt: String(Math.floor(Date.now() / 1000) - 1036800), thumb: null, watched: false, episodes: 2, genres: ['Policier', 'Drame'], contentRating: 'TV-MA', rating: '7.5' },
  ],
}

export const mockSonarr = {
  downloading: [
    { title: 'Severance', year: 2022, progress: 65, eta: new Date(Date.now() + 18 * 60000).toISOString(), poster: null, episodeCount: 3, season: 2, episode: 8 },
  ],
  missing: [
    { title: 'The Last of Us', year: 2023, poster: null },
  ],
}

export const mockRadarr = {
  downloading: [
    { title: 'Highlander', year: '1986', progress: 42, eta: new Date(Date.now() + 23 * 60000).toISOString(), poster: 'https://image.tmdb.org/t/p/w300/8Z8dptJEypuLoOQro1WugD855YE.jpg' },
    { title: 'Blade Runner 2049', year: '2017', progress: 73, eta: new Date(Date.now() + 12 * 60000).toISOString(), poster: 'https://image.tmdb.org/t/p/w300/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg' },
    { title: 'Dhurandhar', year: '2025', progress: 9, eta: new Date(Date.now() + 85 * 60000).toISOString(), poster: 'https://image.tmdb.org/t/p/w300/jFyGtlQFBsyIKMFzIuQ0fEiNjS4.jpg' },
  ],
  missing: [
    { title: 'The Bone Temple', year: '2025' },
    { title: 'Exit 8', year: '2024' },
    { title: 'Send Help', year: '2025' },
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
