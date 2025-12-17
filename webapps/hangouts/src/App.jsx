import { useState, useEffect } from 'react'
import VideoCall from './components/VideoCall'
import { getUrlParams } from './utils/url'

function App() {
  const [params, setParams] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    try {
      const urlParams = getUrlParams()

      // Validate required parameters
      if (!urlParams.room || !urlParams.token || !urlParams.uid) {
        throw new Error('Missing required parameters: room, token, and uid are required')
      }

      setParams(urlParams)
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
      <VideoCall {...params} />
    </div>
  )
}

export default App
