import React from 'react'
import './dashboard.css'  // see styles below

export default function Dashboard() {
  return (
    <div className="dashboard-landing">
      <img src="/logos/splitfin.png" alt="Splitfin" className="dashboard-logo" />
      <p className="dashboard-prompt">
        Please select an option from the left
      </p>
    </div>
  )
}