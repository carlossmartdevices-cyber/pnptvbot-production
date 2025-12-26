import { useState, useEffect } from 'react'
import RadioPlayer from './components/RadioPlayer'
import { getUrlParams } from './utils/url'

function App() {
  const [params, setParams] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    try {
      const urlParams = getUrlParams()

      // For radio, we just need the stream info
      // Token and room are optional for public radio streams
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
          <p>Loading PNPtv Radio...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <RadioPlayer {...params} />
    </div>
  )
}

export default App
