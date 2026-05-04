import { useEffect, useRef, useState } from 'react'
import { Scan, Sparkles, ArrowRight, Play } from 'lucide-react'

// Animated AR ring overlay component
function ARRings() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="absolute rounded-full border"
          style={{
            width: `${i * 120}px`,
            height: `${i * 120}px`,
            borderColor: `rgba(212, 168, 83, ${0.4 - i * 0.1})`,
            animation: `scanRing ${1.5 + i * 0.5}s ease-in-out infinite`,
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
      <div
        className="absolute rounded-full border-2 animate-rotate-ring"
        style={{
          width: '180px',
          height: '180px',
          borderColor: 'transparent',
          borderTopColor: 'rgba(212, 168, 83, 0.6)',
          borderRightColor: 'rgba(212, 168, 83, 0.3)',
        }}
      />
    </div>
  )
}

// Floating data tag
function DataTag({ label, value, style }) {
  return (
    <div className="glass-light rounded-xl px-3 py-2 animate-float" style={style}>
      <p className="text-xs" style={{ color: 'rgba(240, 237, 232, 0.5)', fontFamily: 'Inter' }}>{label}</p>
      <p className="text-sm font-semibold" style={{ color: '#D4A853', fontFamily: 'Inter' }}>{value}</p>
    </div>
  )
}

export default function Hero() {
  const [typedText, setTypedText] = useState('')
  const phrases = ['App-Free.', 'Scan & See.', 'Just Magical.']
  const phraseIdx = useRef(0)
  const charIdx = useRef(0)
  const deleting = useRef(false)

  useEffect(() => {
    const type = () => {
      const current = phrases[phraseIdx.current]
      if (!deleting.current) {
        setTypedText(current.slice(0, charIdx.current + 1))
        charIdx.current++
        if (charIdx.current === current.length) {
          deleting.current = true
          setTimeout(type, 1800)
          return
        }
      } else {
        setTypedText(current.slice(0, charIdx.current - 1))
        charIdx.current--
        if (charIdx.current === 0) {
          deleting.current = false
          phraseIdx.current = (phraseIdx.current + 1) % phrases.length
        }
      }
      setTimeout(type, deleting.current ? 60 : 110)
    }
    const t = setTimeout(type, 500)
    return () => clearTimeout(t)
  }, [])

  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center overflow-hidden scroll-mt-20"
      style={{
        background: `
          radial-gradient(ellipse 80% 60% at 50% 0%, rgba(212, 168, 83, 0.12) 0%, transparent 60%),
          radial-gradient(ellipse 50% 80% at 80% 50%, rgba(212, 168, 83, 0.06) 0%, transparent 50%),
          #0A0A0F
        `,
      }}
    >
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(212, 168, 83, 1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(212, 168, 83, 1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Particle dots */}
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: Math.random() > 0.5 ? '3px' : '2px',
            height: Math.random() > 0.5 ? '3px' : '2px',
            background: 'rgba(212, 168, 83, 0.5)',
            top: `${10 + Math.random() * 80}%`,
            left: `${5 + Math.random() * 90}%`,
            animation: `pulse-gold ${2 + Math.random() * 3}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 2}s`,
          }}
        />
      ))}

      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 xl:px-16 pt-40 lg:pt-56 pb-32 grid lg:grid-cols-2 gap-12 xl:gap-20 items-center w-full">
        {/* Left content */}
        <div className="reveal-up">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 glass-light rounded-full px-4 py-2 mb-6 reveal-scale delay-200">
            <div className="w-2 h-2 rounded-full animate-pulse-gold" style={{ background: '#D4A853' }} />
            <span className="text-xs font-medium tracking-widest uppercase" style={{ color: '#D4A853', fontFamily: 'Inter' }}>
              Augmented Reality Dining
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] mb-6 reveal-up delay-300">
            <span style={{ color: '#F0EDE8' }}>The Menu That</span>
            <br />
            <span style={{ color: '#F0EDE8' }}>Comes</span>{' '}
            <span className="text-gold-gradient gold-glow-text">Alive.</span>
            <br />
            <span
              className="text-gold-gradient"
              style={{ fontSize: '0.75em', fontStyle: 'italic' }}
            >
              {typedText}
              <span
                className="animate-pulse-gold"
                style={{ color: '#D4A853', borderRight: '2px solid #D4A853', marginLeft: '2px' }}
              >
                &nbsp;
              </span>
            </span>
          </h1>

          {/* Subheading */}
          <p
            className="text-lg leading-relaxed mb-10 max-w-xl reveal-up delay-400"
            style={{ color: 'rgba(240, 237, 232, 0.65)', fontFamily: 'Inter' }}
          >
            Transform your restaurant menu into a breathtaking 3D holographic experience.
            Guests scan a card — no app needed — and see every dish in stunning augmented reality.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-4 items-start reveal-up delay-500">
            <a
              href="#how-it-works"
              className="btn-gold px-8 py-4 rounded-xl text-base inline-flex items-center justify-center gap-2"
            >
              <Scan size={18} />
              See How It Works
              <ArrowRight size={16} />
            </a>
            <a
              href="#contact"
              className="btn-ghost px-8 py-4 rounded-xl text-base inline-flex items-center justify-center gap-2"
            >
              <Play size={16} />
              Watch Demo
            </a>
          </div>

          {/* Trust stats */}
          <div className="flex flex-wrap gap-8 mt-10 pt-8 border-t reveal-up delay-500" style={{ borderColor: 'rgba(212, 168, 83, 0.15)' }}>
            {[
              { value: '300+', label: 'Restaurants' },
              { value: '4.9★', label: 'Average Rating' },
              { value: '2M+', label: 'AR Views' },
            ].map((stat, idx) => (
              <div key={stat.label} className={`reveal-scale delay-${500 + idx * 100}`}>
                <p className="font-serif text-2xl font-bold text-gold-gradient">{stat.value}</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(240, 237, 232, 0.5)', fontFamily: 'Inter' }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right — AR phone mockup */}
        <div className="relative flex items-center justify-center reveal-right delay-300">
          {/* Glow backdrop */}
          <div
            className="absolute w-80 h-80 rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, rgba(212, 168, 83, 0.2) 0%, transparent 70%)' }}
          />

          {/* AR Rings */}
          <div className="relative w-72 h-72">
            <ARRings />
          </div>

          {/* Phone image */}
          <div
            className="absolute glass rounded-3xl overflow-hidden animate-float gold-glow"
            style={{ width: '260px', height: '420px', animationDelay: '0s' }}
          >
            <img
              src="/ar_hero_phone.png"
              alt="AR menu experience on smartphone"
              className="w-full h-full object-cover"
            />
            {/* Glass overlay */}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 60%, rgba(10,10,15,0.7) 100%)' }} />
            {/* AR badge overlay */}
            <div className="absolute top-4 right-4">
              <span className="ar-badge">AR LIVE</span>
            </div>
            {/* Bottom info */}
            <div className="absolute bottom-4 left-4 right-4 glass rounded-xl p-3">
              <p className="font-serif text-sm font-semibold" style={{ color: '#F0EDE8' }}>Truffle Risotto</p>
              <div className="flex items-center justify-between mt-1">
                <p className="font-serif text-base font-bold" style={{ color: '#D4A853' }}>€28.00</p>
                <span className="ar-badge">3D VIEW</span>
              </div>
            </div>
          </div>

          {/* Floating data tags */}
          <DataTag
            label="Tracking"
            value="✓ Found"
            style={{ position: 'absolute', top: '5%', left: '-10%', animationDelay: '0.5s' }}
          />
          <DataTag
            label="Model Quality"
            value="HD Ready"
            style={{ position: 'absolute', bottom: '15%', right: '-12%', animationDelay: '1s' }}
          />
          <DataTag
            label="Calories"
            value="420 kcal"
            style={{ position: 'absolute', top: '40%', right: '-15%', animationDelay: '1.5s' }}
          />

          {/* Sparkle icon */}
          <div className="absolute top-2 left-0 text-gold animate-pulse-gold" style={{ color: '#D4A853' }}>
            <Sparkles size={24} />
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32"
        style={{ background: 'linear-gradient(to bottom, transparent, #0A0A0F)' }}
      />
    </section>
  )
}
