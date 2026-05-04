import { useState } from 'react'
import { Check, Zap, Crown, Building2, ArrowRight } from 'lucide-react'

const plans = [
  {
    id: 'launch',
    icon: Zap,
    name: 'Paladeium Launch',
    price: '15,000',
    unit: 'One-time Setup',
    description: 'Complete setup for your restaurant including QR menu installation and 3D modeling.',
    badge: 'Most Popular',
    features: [
      'Base App Building',
      'QR Menu Installation',
      '10 Dishes in Stunning AR',
      'WebAR (No App Needed)',
      'Custom Branding & Colors',
      'Premium Analytics Dashboard',
    ],
    notIncluded: [
      'Ongoing Development (₹500/mo)',
      'Extra Dishes (₹500/dish)',
    ],
    cta: 'Get Started Now',
    ctaStyle: 'gold',
  },
  {
    id: 'addons',
    icon: Crown,
    name: 'Expansion Pack',
    price: '500',
    unit: 'Per Additional Dish',
    description: 'Scale your menu as you grow. Add any number of dishes to your AR library anytime.',
    badge: null,
    features: [
      'Professional 3D Scanning',
      'Texture Optimization',
      'Realistic Lighting Effects',
      'Animation Setup',
      'Immediate Menu Integration',
    ],
    notIncluded: [],
    cta: 'Add More Dishes',
    ctaStyle: 'ghost',
  },
  {
    id: 'maintenance',
    icon: Building2,
    name: 'Managed Growth',
    price: '500',
    unit: 'Per Month',
    description: 'Ongoing development, hosting, and technical support to keep your menu running 24/7.',
    badge: 'Essential',
    features: [
      'High-Speed CDN Hosting',
      'Ongoing Technical Support',
      'Monthly Feature Updates',
      'Security Patches',
      'Performance Monitoring',
    ],
    notIncluded: [],
    cta: 'Learn More',
    ctaStyle: 'ghost',
  },
]

const addOns = [
  { name: 'Custom POS Sync', price: '₹2,500', description: 'Connect your AR menu directly to your kitchen display system' },
  { name: 'Physical Card Print', price: '₹1,200', description: '50 premium branded QR coasters or table cards' },
  { name: 'Social Media Kit', price: '₹900', description: 'AR-ready QR codes for Instagram and Facebook ads' },
  { name: 'Photogrammetry Session', price: '₹3,000', description: 'On-site professional scanning for 20+ dishes' },
]

export default function Pricing() {
  return (
    <section
      id="pricing"
      className="py-32 md:py-40 relative overflow-hidden scroll-mt-20"
      style={{
        background: `
          radial-gradient(ellipse 70% 50% at 30% 50%, rgba(212, 168, 83, 0.06) 0%, transparent 60%),
          #0F0F1A
        `,
      }}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 xl:px-16">
        {/* Header */}
        <div className="text-center mb-14 reveal-up">
          <div className="inline-flex items-center gap-2 glass-light rounded-full px-4 py-2 mb-6 reveal-scale delay-100">
            <span className="text-xs font-medium tracking-widest uppercase" style={{ color: '#D4A853', fontFamily: 'Inter' }}>
              Pricing
            </span>
          </div>
          <h2 className="font-serif text-4xl md:text-5xl font-bold mb-4 reveal-up delay-200" style={{ color: '#F0EDE8' }}>
            Simple,{' '}
            <span className="text-gold-gradient">Local</span>{' '}
            Pricing
          </h2>
          <p className="text-lg max-w-xl mx-auto mb-8 reveal-up delay-300" style={{ color: 'rgba(240, 237, 232, 0.6)', fontFamily: 'Inter' }}>
            Start your AR journey with a one-time setup fee and scale your menu as you grow.
          </p>
        </div>
 
        {/* Plans */}
        <div className="grid lg:grid-cols-3 gap-8 lg:gap-10 mb-16">
          {plans.map((plan, idx) => {
            const Icon = plan.icon
            const isLaunch = plan.id === 'launch'
 
            return (
              <div
                key={plan.id}
                className={`glass rounded-3xl p-10 md:p-12 card-hover relative flex flex-col reveal-up delay-${(idx + 1) * 200} ${
                  isLaunch ? 'gold-glow' : ''
                }`}
                style={isLaunch ? { borderColor: 'rgba(212,168,83,0.5)', paddingTop: plan.badge ? '2.5rem' : '2rem' } : { paddingTop: plan.badge ? '2.5rem' : '2rem' }}
              >
                {/* Badge */}
                {plan.badge && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-semibold reveal-scale delay-500"
                    style={{
                      background: isLaunch
                        ? 'linear-gradient(135deg, #D4A853, #F0C97A)'
                        : 'rgba(212, 168, 83, 0.15)',
                      color: isLaunch ? '#0A0A0F' : '#D4A853',
                      border: isLaunch ? 'none' : '1px solid rgba(212,168,83,0.3)',
                      fontFamily: 'Inter',
                    }}
                  >
                    {plan.badge}
                  </div>
                )}
 
                {/* Plan header */}
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: isLaunch ? 'rgba(212,168,83,0.2)' : 'rgba(212,168,83,0.08)',
                      border: `1px solid rgba(212,168,83,${isLaunch ? 0.5 : 0.2})`,
                    }}
                  >
                    <Icon size={18} style={{ color: '#D4A853' }} />
                  </div>
                  <span className="font-serif text-xl font-bold" style={{ color: '#F0EDE8' }}>
                    {plan.name}
                  </span>
                </div>
 
                {/* Price */}
                <div className="mb-5">
                  <div className="flex items-end gap-1">
                    <span className="font-serif text-5xl font-bold text-gold-gradient">
                      ₹{plan.price}
                    </span>
                    <span className="text-sm pb-2" style={{ color: 'rgba(240,237,232,0.5)', fontFamily: 'Inter' }}>
                      / {plan.unit}
                    </span>
                  </div>
                </div>
 
                <p
                  className="text-sm mb-6"
                  style={{ color: 'rgba(240,237,232,0.55)', fontFamily: 'Inter' }}
                >
                  {plan.description}
                </p>
 
                {/* CTA */}
                <a
                  href="#contact"
                  className={`w-full py-3.5 rounded-xl text-sm font-semibold text-center inline-flex items-center justify-center gap-2 mb-7 transition-all duration-200 ${
                    plan.ctaStyle === 'gold' ? 'btn-gold' : 'btn-ghost'
                  }`}
                  style={{ fontFamily: 'Inter' }}
                >
                  {plan.cta}
                  <ArrowRight size={14} />
                </a>
 
                {/* Features */}
                <div className="flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-start gap-3">
                      <Check
                        size={15}
                        className="flex-shrink-0 mt-0.5"
                        style={{ color: '#D4A853' }}
                      />
                      <span className="text-sm" style={{ color: 'rgba(240,237,232,0.75)', fontFamily: 'Inter' }}>
                        {f}
                      </span>
                    </div>
                  ))}
                  {plan.notIncluded.map((f) => (
                    <div key={f} className="flex items-start gap-3 opacity-35">
                      <div className="w-[15px] h-[15px] mt-0.5 flex-shrink-0 flex items-center justify-center">
                        <div className="w-2.5 h-px" style={{ background: 'rgba(240,237,232,0.4)' }} />
                      </div>
                      <span className="text-sm" style={{ color: 'rgba(240,237,232,0.4)', fontFamily: 'Inter' }}>
                        {f}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Add-ons */}
        <div className="pt-4">
          <h3 className="font-serif text-2xl font-bold mb-6 text-center" style={{ color: '#F0EDE8' }}>
            Optional Add-Ons
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {addOns.map((addon) => (
              <div
                key={addon.name}
                className="glass-light rounded-2xl p-6 md:p-8 card-hover"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-sm" style={{ color: '#F0EDE8', fontFamily: 'Inter' }}>
                    {addon.name}
                  </p>
                  <span className="text-sm font-bold" style={{ color: '#D4A853', fontFamily: 'Inter' }}>
                    {addon.price}
                  </span>
                </div>
                <p className="text-xs" style={{ color: 'rgba(240,237,232,0.5)', fontFamily: 'Inter' }}>
                  {addon.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
