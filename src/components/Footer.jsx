// All social icons as inline SVG to avoid lucide-react version compatibility issues

function XIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.736-8.854L1.254 2.25H8.08l4.259 5.636L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  )
}

function LinkedinIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  )
}

function InstagramIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}

function GithubIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

const footerLinks = {
  Product: ['How It Works', 'Features', 'Pricing', 'Changelog', 'Roadmap'],
  Company: ['About Us', 'Blog', 'Careers', 'Press Kit', 'Contact'],
  Legal: ['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'GDPR'],
  Support: ['Documentation', 'Status', 'Community', 'API Reference'],
}

const socials = [
  { icon: XIcon, label: 'X (Twitter)', href: '#' },
  { icon: LinkedinIcon, label: 'LinkedIn', href: '#' },
  { icon: InstagramIcon, label: 'Instagram', href: '#' },
  { icon: GithubIcon, label: 'GitHub', href: '#' },
]

export default function Footer() {
  return (
    <footer
      className="relative pt-24 pb-12 overflow-hidden"
      style={{ background: '#0A0A0F' }}
    >
      {/* Top divider */}
      <div className="divider-gold mb-16" />

      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 xl:px-16">
        <div className="grid lg:grid-cols-5 gap-10 xl:gap-14 mb-14">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #D4A853, #F0C97A)' }}
              >
                <span className="text-[#0A0A0F] font-bold text-sm font-serif">P</span>
              </div>
              <span className="font-serif text-xl font-semibold text-gold-gradient">Paladeium</span>
            </div>
            <p
              className="text-sm leading-relaxed mb-6"
              style={{ color: 'rgba(240,237,232,0.5)', fontFamily: 'Inter' }}
            >
              The world&apos;s first app-free augmented reality menu platform for premium dining venues.
            </p>
            {/* Socials */}
            <div className="flex gap-3">
              {socials.map((social) => {
                const Icon = social.icon
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200"
                    style={{
                      background: 'rgba(212,168,83,0.08)',
                      border: '1px solid rgba(212,168,83,0.15)',
                      color: 'rgba(240,237,232,0.5)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(212,168,83,0.15)'
                      e.currentTarget.style.color = '#D4A853'
                      e.currentTarget.style.borderColor = 'rgba(212,168,83,0.4)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(212,168,83,0.08)'
                      e.currentTarget.style.color = 'rgba(240,237,232,0.5)'
                      e.currentTarget.style.borderColor = 'rgba(212,168,83,0.15)'
                    }}
                  >
                    <Icon size={16} />
                  </a>
                )
              })}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4
                className="text-xs font-semibold tracking-widest uppercase mb-4"
                style={{ color: '#D4A853', fontFamily: 'Inter' }}
              >
                {category}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm transition-colors duration-200"
                      style={{ color: 'rgba(240,237,232,0.5)', fontFamily: 'Inter' }}
                      onMouseEnter={e => e.target.style.color = '#D4A853'}
                      onMouseLeave={e => e.target.style.color = 'rgba(240,237,232,0.5)'}
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="divider-gold mb-8" />
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs" style={{ color: 'rgba(240,237,232,0.35)', fontFamily: 'Inter' }}>
            &copy; 2026 Paladeium Technologies Ltd. All rights reserved.
          </p>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse-gold" style={{ background: '#D4A853' }} />
            <p className="text-xs" style={{ color: 'rgba(240,237,232,0.35)', fontFamily: 'Inter' }}>
              All systems operational
            </p>
          </div>
          <p className="text-xs" style={{ color: 'rgba(240,237,232,0.35)', fontFamily: 'Inter' }}>
            Designed with &diams; in London
          </p>
        </div>
      </div>
    </footer>
  )
}
