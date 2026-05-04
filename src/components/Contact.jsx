import { useState } from 'react'
import { Mail, Phone, Building2, Send, CheckCircle, Loader2 } from 'lucide-react'
import { supabase } from '../supabase'

export default function Contact() {
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    restaurant: '',
    size: '',
    message: '',
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error: sbError } = await supabase
        .from('leads')
        .insert([
          {
            full_name: form.name,
            email: form.email,
            restaurant_name: form.restaurant,
            restaurant_size: form.size,
            message: form.message,
          }
        ])

      if (sbError) throw sbError
      
      setSubmitted(true)
    } catch (err) {
      console.error('Error submitting form:', err)
      setError('Something went wrong. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section
      id="contact"
      className="py-32 md:py-40 relative overflow-hidden scroll-mt-20"
      style={{
        background: `
          radial-gradient(ellipse 50% 60% at 20% 50%, rgba(212, 168, 83, 0.07) 0%, transparent 60%),
          #0F0F1A
        `,
      }}
    >
      <div className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-12 xl:px-16">
        {/* Header */}
        <div className="text-center mb-14 reveal-up">
          <div className="inline-flex items-center gap-2 glass-light rounded-full px-4 py-2 mb-6 reveal-scale delay-100">
            <span className="text-xs font-medium tracking-widest uppercase" style={{ color: '#D4A853', fontFamily: 'Inter' }}>
              Get In Touch
            </span>
          </div>
          <h2 className="font-serif text-4xl md:text-5xl font-bold mb-4 reveal-up delay-200" style={{ color: '#F0EDE8' }}>
            Ready to Transform{' '}
            <span className="text-gold-gradient">Your Menu?</span>
          </h2>
          <p className="text-lg max-w-xl mx-auto reveal-up delay-300" style={{ color: 'rgba(240, 237, 232, 0.6)', fontFamily: 'Inter' }}>
            Book a live demo with our team. We'll show you the full AR experience tailored to your menu.
          </p>
        </div>
 
        <div className="grid lg:grid-cols-2 gap-10 xl:gap-14 items-start">
          {/* Left — Contact info */}
          <div className="reveal-left delay-400">
            <div className="space-y-6 mb-10">
              {[
                { icon: Mail, label: 'Email Us', value: 'hello@paladeium.com', sub: 'Response within 2 hours' },
                { icon: Phone, label: 'Call Us', value: '+1 (888) PAL-MENU', sub: 'Mon–Fri, 9am–6pm EST' },
                { icon: Building2, label: 'Headquarters', value: 'London, UK', sub: 'Global remote team' },
              ].map((item, idx) => {
                const Icon = item.icon
                return (
                  <div key={item.label} className={`flex items-center gap-4 reveal-scale delay-${(idx + 1) * 100 + 400}`}>
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(212,168,83,0.1)', border: '1px solid rgba(212,168,83,0.25)' }}
                    >
                      <Icon size={20} style={{ color: '#D4A853' }} />
                    </div>
                    <div>
                      <p className="text-xs mb-0.5" style={{ color: 'rgba(240,237,232,0.45)', fontFamily: 'Inter' }}>{item.label}</p>
                      <p className="font-semibold text-sm" style={{ color: '#F0EDE8', fontFamily: 'Inter' }}>{item.value}</p>
                      <p className="text-xs" style={{ color: 'rgba(240,237,232,0.4)', fontFamily: 'Inter' }}>{item.sub}</p>
                    </div>
                  </div>
                )
              })}
            </div>
 
            {/* Trust signals */}
            <div className="glass rounded-3xl p-8 md:p-10 reveal-up delay-700">
              <p className="text-sm font-semibold mb-4" style={{ color: '#F0EDE8', fontFamily: 'Inter' }}>
                Why teams choose Paladeium:
              </p>
              {[
                '✦ 14-day free trial, no credit card',
                '✦ Live onboarding session included',
                '✦ Cancel anytime, no lock-in',
                '✦ 99.9% uptime SLA (Pro+)',
              ].map((item) => (
                <p
                  key={item}
                  className="text-sm py-2 border-b"
                  style={{
                    color: 'rgba(240,237,232,0.65)',
                    borderColor: 'rgba(212,168,83,0.1)',
                    fontFamily: 'Inter',
                  }}
                >
                  {item}
                </p>
              ))}
            </div>
          </div>
 
          {/* Right — Form */}
          <div className="glass rounded-3xl p-10 md:p-12 reveal-right delay-400">
            {submitted ? (
              <div className="text-center py-12 reveal-scale">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
                  style={{ background: 'rgba(212,168,83,0.15)', border: '1px solid rgba(212,168,83,0.3)' }}
                >
                  <CheckCircle size={32} style={{ color: '#D4A853' }} />
                </div>
                <h3 className="font-serif text-2xl font-bold mb-3" style={{ color: '#F0EDE8' }}>
                  You're on the list!
                </h3>
                <p className="text-sm" style={{ color: 'rgba(240,237,232,0.6)', fontFamily: 'Inter' }}>
                  We'll reach out within 2 hours to schedule your personalized demo.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="reveal-up delay-500">
                    <label className="block text-xs mb-2" style={{ color: 'rgba(240,237,232,0.55)', fontFamily: 'Inter' }}>
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Marco Bellini"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(212,168,83,0.2)',
                        color: '#F0EDE8',
                        fontFamily: 'Inter',
                      }}
                      onFocus={(e) => e.target.style.borderColor = 'rgba(212,168,83,0.6)'}
                      onBlur={(e) => e.target.style.borderColor = 'rgba(212,168,83,0.2)'}
                    />
                  </div>
                  <div className="reveal-up delay-500">
                    <label className="block text-xs mb-2" style={{ color: 'rgba(240,237,232,0.55)', fontFamily: 'Inter' }}>
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="you@restaurant.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(212,168,83,0.2)',
                        color: '#F0EDE8',
                        fontFamily: 'Inter',
                      }}
                      onFocus={(e) => e.target.style.borderColor = 'rgba(212,168,83,0.6)'}
                      onBlur={(e) => e.target.style.borderColor = 'rgba(212,168,83,0.2)'}
                    />
                  </div>
                </div>
 
                <div className="reveal-up delay-600">
                  <label className="block text-xs mb-2" style={{ color: 'rgba(240,237,232,0.55)', fontFamily: 'Inter' }}>
                    Restaurant Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Osteria Moderna"
                    value={form.restaurant}
                    onChange={(e) => setForm({ ...form, restaurant: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
                    style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(212,168,83,0.2)',
                        color: '#F0EDE8',
                        fontFamily: 'Inter',
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'rgba(212,168,83,0.6)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(212,168,83,0.2)'}
                  />
                </div>
 
                <div className="reveal-up delay-700">
                  <label className="block text-xs mb-2" style={{ color: 'rgba(240,237,232,0.55)', fontFamily: 'Inter' }}>
                    Restaurant Size
                  </label>
                  <select
                    required
                    value={form.size}
                    onChange={(e) => setForm({ ...form, size: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
                    style={{
                      background: 'rgba(10,10,20,0.9)',
                      border: '1px solid rgba(212,168,83,0.2)',
                      color: form.size ? '#F0EDE8' : 'rgba(240,237,232,0.35)',
                      fontFamily: 'Inter',
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'rgba(212,168,83,0.6)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(212,168,83,0.2)'}
                  >
                    <option value="" disabled>Select covers per night</option>
                    <option value="small" style={{ background: '#0A0A0F', color: '#F0EDE8' }}>Under 50 covers</option>
                    <option value="medium" style={{ background: '#0A0A0F', color: '#F0EDE8' }}>50–150 covers</option>
                    <option value="large" style={{ background: '#0A0A0F', color: '#F0EDE8' }}>150–500 covers</option>
                    <option value="enterprise" style={{ background: '#0A0A0F', color: '#F0EDE8' }}>500+ covers / Chain</option>
                  </select>
                </div>
 
                <div className="reveal-up delay-800">
                  <label className="block text-xs mb-2" style={{ color: 'rgba(240,237,232,0.55)', fontFamily: 'Inter' }}>
                    Message (optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Tell us about your menu or any specific questions..."
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none transition-all duration-200"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(212,168,83,0.2)',
                      color: '#F0EDE8',
                      fontFamily: 'Inter',
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'rgba(212,168,83,0.6)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(212,168,83,0.2)'}
                  />
                </div>
 
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-gold w-full py-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 reveal-up delay-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ fontFamily: 'Inter' }}
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                  {loading ? 'Submitting...' : 'Book My Free Demo'}
                </button>
 
                {error && (
                  <p className="text-xs text-center mt-3 text-red-400" style={{ fontFamily: 'Inter' }}>
                    {error}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
