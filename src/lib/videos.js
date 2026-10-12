// More videos playing at once than this slow Chromium down on the Pi: past it, none of a page's videos
// plays by itself (each shows its poster, marked ▶; the detail view plays the one tapped)
export const MAX_PLAYING_VIDEOS = 2

export function videosCanPlay(notes) {
  return notes.filter((note) => note?.video).length <= MAX_PLAYING_VIDEOS
}
