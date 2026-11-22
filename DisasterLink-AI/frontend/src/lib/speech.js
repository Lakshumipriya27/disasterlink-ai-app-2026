// Web Speech API helpers. Text-to-speech is widely supported; speech recognition is not (Chrome/Edge only,
// and Chrome sends audio to an online service - so it does not work offline). We detect and say so.
export const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
const Recognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
export const sttSupported = !!Recognition

export function speak(text, { lang = 'en-IN', rate = 0.95 } = {}) {
  if (!ttsSupported) return false
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang; u.rate = rate
  window.speechSynthesis.speak(u)
  return true
}
export const stopSpeaking = () => ttsSupported && window.speechSynthesis.cancel()

export function listen({ lang = 'en-IN', onResult, onEnd, onError }) {
  if (!Recognition) { onError?.('Speech recognition is not supported in this browser.'); return null }
  const r = new Recognition()
  r.lang = lang; r.interimResults = true; r.continuous = false
  r.onresult = (e) => {
    let text = ''
    for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript
    onResult?.(text, e.results[e.results.length - 1].isFinal)
  }
  r.onerror = (e) => onError?.(e.error === 'network' ? 'Speech recognition needs an internet connection in this browser.' : `Speech recognition error: ${e.error}`)
  r.onend = () => onEnd?.()
  r.start()
  return r
}
