import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function Card({ title, subtitle, icon, to }) {
  const nav = useNavigate()
  return (
    <div className="big-card" onClick={() => to && nav(to)}>
      <div className="card-icon">{icon}</div>
      <div className="card-title">{title}</div>
      <div className="card-sub">{subtitle}</div>
    </div>
  )
}
