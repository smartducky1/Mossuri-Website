import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import TaskPage from './task/TaskPage'

function HomePage() {
  return (
    <>
      {/* Your existing Mossuri homepage code stays here. */}
      {/* IMPORTANT: paste your current working main.jsx homepage code here. */}
    </>
  )
}

function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'

  if (path === '/task') {
    return <TaskPage />
  }

  return <HomePage />
}

createRoot(document.getElementById('root')).render(<App />)
