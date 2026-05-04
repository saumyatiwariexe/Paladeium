import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'

const navLinks = [
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Features', href: '#features' },
  { label: 'Benefits', href: '#benefits' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Future', href: '#future' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 reveal-down visible ${
        scrolled ? 'glass py-3' : 'py-5 bg-transparent'
      }`}
    >
      {/* Inner container — max width + consistent horizontal padding */}
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 xl:px-16 flex items-center justify-between">

        {/* Logo */}
        <a href="#" className="flex items-center gap-3 group">
          <div
            className="w-9 h-9 rounded-lg gold-glow flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #D4A853, #F0C97A)' }}
          >
            <span className="text-[#0A0A0F] font-bold text-sm font-serif">P</span>
          </div>
          <span className="font-serif text-xl font-semibold text-gold-gradient">Paladeium</span>
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium transition-colors duration-200 py-1"
              style={{ color: 'rgba(240, 237, 232, 0.7)' }}
              onMouseEnter={e => e.target.style.color = '#D4A853'}
              onMouseLeave={e => e.target.style.color = 'rgba(240, 237, 232, 0.7)'}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* CTA buttons */}
        <div className="hidden md:flex items-center gap-3">
          <a href="#pricing" className="btn-ghost px-5 py-2.5 rounded-lg text-sm">
            Get Started
          </a>
          <a
            href="#contact"
            className="btn-gold px-5 py-2.5 rounded-lg text-sm"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Book Demo
          </a>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden p-2.5 rounded-lg glass-light"
          style={{ color: '#D4A853' }}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="md:hidden glass mt-2 mx-4 sm:mx-6 rounded-3xl p-8">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium px-3 py-3 rounded-xl transition-colors duration-200"
                style={{ color: 'rgba(240, 237, 232, 0.8)' }}
                onClick={() => setMenuOpen(false)}
                onMouseEnter={e => e.currentTarget.style.color = '#D4A853'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(240, 237, 232, 0.8)'}
              >
                {link.label}
              </a>
            ))}
            <div className="h-px my-2" style={{ background: 'rgba(212,168,83,0.15)' }} />
            <a
              href="#contact"
              className="btn-gold px-5 py-3.5 rounded-xl text-sm text-center mt-1"
              onClick={() => setMenuOpen(false)}
            >
              Book Demo
            </a>
          </div>
        </div>
      )}
    </nav>
  )
}
