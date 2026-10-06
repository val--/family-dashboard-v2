// Dates of a Google Calendar event as the API gives them. All-day events come as "YYYY-MM-DD": they are
// built as local dates, not UTC ones, so they stay on the right day.

export function eventStart(event) {
  if (event.allDay) {
    const [y, m, d] = event.start.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(event.start)
}

// When it ends. Google's all-day end date is exclusive: the start of the day after the last one.
export function eventEnd(event) {
  if (event.allDay) {
    const [y, m, d] = event.end.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(event.end)
}

// Its last day (midnight), for "du 12 au 14 octobre"
export function eventLastDay(event) {
  if (event.allDay) {
    const [y, m, d] = event.end.split('-').map(Number)
    return new Date(y, m - 1, d - 1)
  }
  const end = new Date(event.end)
  return new Date(end.getFullYear(), end.getMonth(), end.getDate())
}
