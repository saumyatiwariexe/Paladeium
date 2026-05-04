import React from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import HowItWorks from './components/HowItWorks'
import Features from './components/Features'
import Benefits from './components/Benefits'
import Pricing from './components/Pricing'
import FutureExpansions from './components/FutureExpansions'
import Contact from './components/Contact'
import Footer from './components/Footer'

export default function App() {
  return (
    <div className="min-h-screen" style={{ background: '#0A0A0F' }}>
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <Benefits />
        <Pricing />
        <FutureExpansions />
        <Contact />
      </main>
      <Footer />
    </div>
  )
}
