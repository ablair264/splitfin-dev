// src/components/NewOrderStart.tsx
import React from 'react'
import { useNavigate } from 'react-router-dom'
import './login.css';


const brands = [
  { name: 'Blomus',    path: 'blomus' },
  { name: 'Elvang',    path: 'elvang' },
  { name: 'My Flame Lifestyle', path: 'my-flame-lifestyle' },
  { name: 'Rader',     path: 'rader' },
  { name: 'Remember',  path: 'remember' },
  { name: 'Relaxound', path: 'relaxound' },
];

export default function NewOrderStart() {
  const nav = useNavigate()
  return (
    <div className="dashboard-welcome">
      <h1>Welcome to your dashboard!</h1>
      <button
        className="btn btn-primary"
        onClick={() => nav('/new-order')}
      >
        New Order
      </button>

      {/* Only show this once they click “New Order” – 
          you could instead drive it by a local state flag */}
     {/* Only show this once they click “New Order” */}
 <div className="brand-section">
        <h2>Choose your brand</h2>
        <div className="brand-grid">
          {brands.map(b => (
            <button
              key={b.path}
              className="brand-card"
              onClick={() => nav(`/products/${b.path}`)}
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}