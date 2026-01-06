import { useState, useEffect } from 'react'
import VideoCall from './components/VideoCall'
import { getUrlParams } from './utils/url'

function App() {
  const [params, setParams] = useState(null)
  const [error, setError] = useState(null)
  const [hasConsent, setHasConsent] = useState(false)

  useEffect(() => {
    try {
      const urlParams = getUrlParams()

      // Validate required parameters
      if (!urlParams.room || !urlParams.token || !urlParams.uid) {
        throw new Error('Missing required parameters: room, token, and uid are required')
      }

      setParams(urlParams)

      // Remove sensitive query params (token) from the address bar to reduce accidental leakage.
      if (window?.history?.replaceState) {
        const cleanUrl = `${window.location.origin}${window.location.pathname}`
        window.history.replaceState({}, document.title, cleanUrl)
      }

      setHasConsent(sessionStorage.getItem('pnp_hangouts_consent_v1') === 'true')
    } catch (err) {
      setError(err.message)
    }
  }, [])

  if (error) {
    return (
      <div className="app">
        <div className="loading">
          <div className="error">
            <h2>Error</h2>
            <p>{error}</p>
            <p style={{ marginTop: '16px', fontSize: '14px' }}>
              Please make sure you have a valid link from the PNPtv Telegram bot.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!params) {
    return (
      <div className="app">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <VideoCall
        {...params}
        hasConsent={hasConsent}
        onConsentGranted={() => {
          sessionStorage.setItem('pnp_hangouts_consent_v1', 'true')
          setHasConsent(true)
        }}
      />
    </div>
  )
}

export default App
