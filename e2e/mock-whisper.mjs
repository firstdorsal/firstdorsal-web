// Mock des whisper-asr-webservice für die E2E-Tests: nimmt den Upload
// entgegen und antwortet mit einem festen Transkript – geprüft wird die
// komplette Pipeline (Upload → pending → Transkript per WebSocket), nicht
// die Modellqualität. In Produktion läuft der echte Dienst (faster-whisper).
import http from 'node:http'

export const TRANSKRIPT = 'Dies ist ein Beispiel-Transkript.'

http
  .createServer((req, res) => {
    if (req.method === 'POST' && req.url?.startsWith('/asr')) {
      req.resume() // Upload konsumieren
      req.on('end', () => {
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ text: TRANSKRIPT }))
      })
      return
    }
    res.statusCode = 404
    res.end()
  })
  .listen(8799, () => console.log('Mock-Whisper auf :8799'))
