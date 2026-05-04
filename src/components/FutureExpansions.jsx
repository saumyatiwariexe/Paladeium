import { Cpu, Globe, ShoppingBag, Map, Brain, Tv } from 'lucide-react'

const roadmapItems = [
  {
    phase: 'Q3 2026',
    status: 'in-progress',
    icon: ShoppingBag,
    title: 'Integrated Ordering',
    description:
      'Complete the loop: guests view a dish in AR and tap "Add to Order" directly in the WebAR view. The order syncs to your POS (Square, Toast, Lightspeed) with zero delay.',
    tags: ['POS Integration', 'WebAR Orders', 'NFC Payments'],
  },
  {
    phase: 'Q4 2026',
    status: 'planned',
    icon: Globe,
    title: 'Spatial Web Menu',
    description:
      'An always-on 3D menu accessible from any browser — share a link and customers explore your full menu in 3D spatial mode before even arriving at the restaurant.',
    tags: ['WebXR Spatial', 'Pre-Visit Discovery', 'Social Sharing'],
  },
  {
    phase: 'Q1 2027',
    status: 'planned',
    icon: Brain,
    title: 'AI Dish Personalization',
    description:
      'Connect to guest preferences via loyalty programs. The AR menu surface highlights dishes based on dietary preferences, past orders, and allergen flags — automatically.',
    tags: ['AI Recommendations', 'Loyalty Sync', 'Dietary Filters'],
  },
  {
    phase: 'Q2 2027',
    status: 'planned',
    icon: Cpu,
    title: 'Apple Vision Pro',
    description:
      'Native visionOS app for Apple Vision Pro — the ultimate fine dining AR experience. Spatial audio, haptic feedback, and fully immersive dish exploration in mixed reality.',
    tags: ['visionOS', 'Spatial Audio', 'Mixed Reality'],
  },
  {
    phase: 'Q3 2027',
    status: 'planned',
    icon: Map,
    title: 'City-Wide Discovery',
    description:
      'Paladeium Explore: an AR city map where users point their phone at a restaurant and see its 3D signature dish floating above the entrance — before they walk in.',
    tags: ['Urban AR', 'Discovery', 'Restaurant Map'],
  },
  {
    phase: 'Q4 2027',
    status: 'planned',
    icon: Tv,
    title: 'Ambient Display Mode',
    description:
      'Cast the AR menu experience to a large restaurant display screen. Rotating dishes and promotional content shown in cinematic 3D — the digital window display of the future.',
    tags: ['Display Mode', 'Digital Signage', 'Promotions'],
  },
]

const statusConfig = {
  'in-progress': {
    label: 'In Progress',
    color: '#D4A853',
    bg: 'rgba(212, 168, 83, 0.15)',
  },
  planned: {
    label: 'Planned',
    color: 'rgba(240,237,232,0.5)',
    bg: 'rgba(240,237,232,0.08)',
  },
}

export default function FutureExpansions() {
  return (
    <section
      id="future"
      className="py-32 md:py-40 relative overflow-hidden scroll-mt-20"
      style={{
        background: `
          radial-gradient(ellipse 60% 60% at 50% 100%, rgba(212, 168, 83, 0.08) 0%, transparent 60%),
          #0A0A0F
        `,
      }}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 xl:px-16">
        {/* Header */}
        <div className="text-center mb-14 reveal-up">
          <div className="inline-flex items-center gap-2 glass-light rounded-full px-4 py-2 mb-6 reveal-scale delay-100">
            <span className="text-xs font-medium tracking-widest uppercase" style={{ color: '#D4A853', fontFamily: 'Inter' }}>
              Roadmap
            </span>
          </div>
          <h2 className="font-serif text-4xl md:text-5xl font-bold mb-4 reveal-up delay-200" style={{ color: '#F0EDE8' }}>
            The Future of{' '}
            <span className="text-gold-gradient">Dining Awaits</span>
          </h2>
          <p className="text-lg max-w-2xl mx-auto reveal-up delay-300" style={{ color: 'rgba(240, 237, 232, 0.6)', fontFamily: 'Inter' }}>
            We're building the AR layer that wraps around the entire restaurant experience —
            from discovery to dessert and beyond.
          </p>
        </div>
 
        {/* Vertical timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div
            className="absolute left-8 top-4 bottom-4 w-px hidden lg:block reveal-up delay-500"
            style={{ background: 'linear-gradient(to bottom, #D4A853, rgba(212,168,83,0.1))' }}
          />
 
          <div className="space-y-8 lg:space-y-10">
            {roadmapItems.map((item, idx) => {
              const Icon = item.icon
              const status = statusConfig[item.status]
 
              return (
                <div
                  key={item.title}
                  className={`lg:pl-24 relative reveal-up delay-${(idx + 1) * 150}`}
                >
                  {/* Timeline dot */}
                  <div
                    className="hidden lg:flex absolute left-4 top-6 w-8 h-8 rounded-full items-center justify-center -translate-x-1/2 reveal-scale delay-500"
                    style={{
                      background: item.status === 'in-progress'
                        ? 'linear-gradient(135deg, #D4A853, #F0C97A)'
                        : 'rgba(212,168,83,0.15)',
                      border: `2px solid ${item.status === 'in-progress' ? '#D4A853' : 'rgba(212,168,83,0.3)'}`,
                    }}
                  >
                    {item.status === 'in-progress' && (
                      <div className="w-2 h-2 rounded-full" style={{ background: '#0A0A0F' }} />
                    )}
                  </div>
 
                  <div className="glass rounded-3xl p-8 md:p-10 card-hover group">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                      {/* Icon + Phase */}
                      <div className="flex-shrink-0 flex items-center gap-4">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center"
                          style={{
                            background: item.status === 'in-progress'
                              ? 'rgba(212,168,83,0.15)'
                              : 'rgba(212,168,83,0.06)',
                            border: `1px solid rgba(212,168,83,${item.status === 'in-progress' ? 0.4 : 0.15})`,
                          }}
                        >
                          <Icon size={22} style={{ color: item.status === 'in-progress' ? '#D4A853' : 'rgba(212,168,83,0.5)' }} />
                        </div>
                        <div>
                          <span
                            className="text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{ background: status.bg, color: status.color, fontFamily: 'Inter' }}
                          >
                            {status.label}
                          </span>
                          <p
                            className="text-xs mt-1 font-medium"
                            style={{ color: '#D4A853', fontFamily: 'Inter' }}
                          >
                            {item.phase}
                          </p>
                        </div>
                      </div>
 
                      {/* Content */}
                      <div className="flex-1">
                        <h3
                          className="font-serif text-xl font-bold mb-2"
                          style={{ color: '#F0EDE8' }}
                        >
                          {item.title}
                        </h3>
                        <p
                          className="text-sm leading-relaxed mb-4"
                          style={{ color: 'rgba(240, 237, 232, 0.65)', fontFamily: 'Inter' }}
                        >
                          {item.description}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {item.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-xs px-3 py-1 rounded-full"
                              style={{
                                background: 'rgba(212,168,83,0.08)',
                                border: '1px solid rgba(212,168,83,0.2)',
                                color: '#D4A853',
                                fontFamily: 'Inter',
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
 
        {/* Vision statement */}
        <div
          className="mt-16 glass rounded-[2.5rem] p-10 md:p-14 text-center relative overflow-hidden reveal-up delay-700"
          style={{ border: '1px solid rgba(212,168,83,0.25)' }}
        >
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(212,168,83,0.15) 0%, transparent 60%)',
            }}
          />
          <img
            src="/ar_food_hologram.png"
            alt="Holographic AR food visualization"
            className="w-full h-60 object-cover rounded-2xl mb-8 relative z-10 reveal-scale delay-800"
            style={{ border: '1px solid rgba(212,168,83,0.2)' }}
          />
          <div className="relative z-10">
            <h3 className="font-serif text-3xl md:text-4xl font-bold mb-4 reveal-up delay-900" style={{ color: '#F0EDE8' }}>
              The AR Layer for{' '}
              <span className="text-gold-gradient">Every Restaurant on Earth</span>
            </h3>
            <p
              className="text-base max-w-2xl mx-auto reveal-up delay-1000"
              style={{ color: 'rgba(240,237,232,0.65)', fontFamily: 'Inter' }}
            >
              Our vision is a world where every menu, in every restaurant, in every city
              becomes a living, breathing 3D experience — powered by the open web.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
