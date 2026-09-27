// The phone page where the family writes post-its. Defaults to this very site, so the QR codes work from
// whatever address the kiosk uses; VITE_POSTIT_URL overrides it.
export const POSTIT_URL = import.meta.env.VITE_POSTIT_URL || `${window.location.origin}/postit`
