import { useMemo, useState, useEffect } from 'react'
import VideoCall from './components/VideoCall'
import Lobby from './components/Lobby'
import { getUrlParams } from './utils/url'

function App() {
  const [params, setParams] = useState(null)
  const [hasConsent, setHasConsent] = useState(false)

  useEffect(() => {
    const urlParams = getUrlParams()

    // If required params are missing, show lobby instead of an error.
    if (!urlParams.room || !urlParams.token || !urlParams.uid) {
      setParams(null)
      setHasConsent(sessionStorage.getItem('pnp_hangouts_consent_v1') === 'true')
      return
    }

    setParams(urlParams)

    // Remove sensitive query params (token) from the address bar to reduce accidental leakage.
    if (window?.history?.replaceState) {
      const cleanUrl = `${window.location.origin}${window.location.pathname}`
      window.history.replaceState({}, document.title, cleanUrl)
    }

    setHasConsent(sessionStorage.getItem('pnp_hangouts_consent_v1') === 'true')
  }, [])

  const lobbyAppId = useMemo(() => {
    return params?.appId || new URLSearchParams(window.location.search || '').get('appId') || undefined
  }, [params])

  if (!params) return <Lobby defaultAppId={lobbyAppId} />

  return (
    <div className="app">
      <div className="bg" />
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
