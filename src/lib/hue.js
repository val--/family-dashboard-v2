// A Hue scene's palette as a round swatch: its colors in a soft diagonal blend
export function sceneSwatch(colors) {
  return colors.length > 1 ? `linear-gradient(135deg, ${colors.join(', ')})` : colors[0]
}

// The scenes chosen as shortcuts, in their order, found in the rooms (with their room's name). Scenes
// deleted from the bridge since are skipped.
export function shortcutScenes(rooms, ids) {
  if (!rooms || !ids?.length) return []
  const all = rooms.flatMap((room) => room.scenes.map((scene) => ({ ...scene, room: room.name })))
  return ids.map((id) => all.find((scene) => scene.id === id)).filter(Boolean)
}
