import { useState, useEffect } from 'react'
import LiveStream from './components/LiveStream'
import { getUrlParams } from './utils/url'

function App() {
  const [params, setParams] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    try {
      const urlParams = getUrlParams()

      // Validate required parameters
      if (!urlParams.stream || !urlParams.token || !urlParams.uid) {
        throw new Error('Missing required parameters')
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
          <p>Loading PNPtv Live...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <LiveStream {...params} />
    </div>
  )
}

export default App
