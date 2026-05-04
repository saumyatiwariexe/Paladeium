import { useState } from 'react'
import {
  Box, Pointer, Zap, Shield, Globe, RefreshCcw,
  Layers, BarChart3, Smartphone, Clock, Star, ChevronRight
} from 'lucide-react'

const featureCategories = [
  { id: 'ar', label: 'AR Experience' },
  { id: 'menu', label: 'Menu Management' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'platform', label: 'Platform' },
]

const features = {
  ar: [
    {
      icon: Box,
      title: 'Life-Sized 3D Models',
      description: "Every dish rendered at real-world scale (~15–20cm), so guests know exactly what they're ordering. No surprises.",
    },
    {
      icon: Pointer,
      title: 'Touch Interaction',
      description: 'Single-finger drag to rotate, pinch to scale, and swipe to switch dishes — intuitive and delightful.',
    },
    {
      icon: Zap,
      title: 'Sub-Second Tracking',
      description: 'MindAR with high-pass filtering (filterBeta: 1000) locks onto the target card in under 800ms with zero jitter.',
    },
    {
      icon: Smartphone,
      title: 'App-Free WebAR',
      description: 'Runs entirely in Safari and Chrome. No App Store, no downloads. Just open the browser camera.',
    },
  ],
  menu: [
    {
      icon: Layers,
      title: 'Category Filtering',
      description: 'Scrollable category pills (Starters, Mains, Desserts) let guests browse your full menu without overwhelm.',
    },
    {
      icon: RefreshCcw,
      title: 'Live Menu Updates',
      description: 'Change prices, add specials, or retire dishes from the dashboard. Changes go live instantly — no reprinting.',
    },
    {
      icon: Star,
      title: 'Allergen & Nutrition Tags',
      description: 'Each 3D dish card displays calorie count, allergens, and chef notes, floating alongside the hologram.',
    },
    {
      icon: Clock,
      title: 'Skeleton Loaders',
      description: 'While 3D models download, beautiful skeleton animations pulse in the AR view to manage expectations.',
    },
  ],
  analytics: [
    {
      icon: BarChart3,
      title: 'View Heatmaps',
      description: 'See which dishes get the most AR views, how long guests spend with each model, and click-through rates.',
    },
    {
      icon: Star,
      title: 'Dish Popularity Score',
      description: 'Paladeium scores each dish by AR engagement — perfect for optimising your menu layout.',
    },
    {
      icon: Globe,
      title: 'Session Analytics',
      description: 'Track sessions per table, peak hours, device breakdown, and geographic reach.',
    },
    {
      icon: RefreshCcw,
      title: 'A/B Menu Testing',
      description: 'Run split tests on dish descriptions, photography vs. 3D, and pricing display formats.',
    },
  ],
  platform: [
    {
      icon: Shield,
      title: 'Enterprise Security',
      description: 'SOC 2 Type II compliant. All assets served over CDN with HTTPS. Restaurant data never leaves your region.',
    },
    {
      icon: Globe,
      title: 'Multi-Language',
      description: "Auto-detect and display menus in the guest's device language. Supports 30+ languages.",
    },
    {
      icon: Zap,
      title: 'CDN-Optimised Assets',
      description: 'KTX2/Basis compressed textures and decimated geometry. Each 3D dish stays under 5MB for fast loads.',
    },
    {
      icon: Smartphone,
      title: 'iOS & Android Ready',
      description: 'Fully tested on Safari iOS 15+ and Chrome Android 90+. Stable across the widest device range.',
    },
  ],
}

export default function Features() {
  const [activeTab, setActiveTab] = useState('ar')

  return (
    <section
      id="features"
      className="py-32 md:py-40 relative overflow-hidden scroll-mt-20"
      style={{
        background: `
          radial-gradient(ellipse 60% 50% at 70% 50%, rgba(212, 168, 83, 0.06) 0%, transparent 60%),
          #0F0F1A
        `,
      }}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 xl:px-16">
        {/* Header */}
        <div className="text-center mb-14 reveal-up">
          <div className="inline-flex items-center gap-2 glass-light rounded-full px-4 py-2 mb-6 reveal-scale delay-100">
            <span className="text-xs font-medium tracking-widest uppercase" style={{ color: '#D4A853', fontFamily: 'Inter' }}>
              Features
            </span>
          </div>
          <h2 className="font-serif text-4xl md:text-5xl font-bold mb-4 reveal-up delay-200" style={{ color: '#F0EDE8' }}>
            Everything You Need to{' '}
            <span className="text-gold-gradient">Impress</span>
          </h2>
          <p className="text-lg max-w-xl mx-auto reveal-up delay-300" style={{ color: 'rgba(240, 237, 232, 0.6)', fontFamily: 'Inter' }}>
            Paladeium is a full-stack AR dining platform — not just a 3D viewer.
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex justify-center mb-12 reveal-up delay-400">
          <div className="glass rounded-2xl p-1.5 inline-flex gap-1">
            {featureCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeTab === cat.id ? 'toggle-active' : 'hover:bg-white/5'
                }`}
                style={{
                  color: activeTab === cat.id ? '#0A0A0F' : 'rgba(240,237,232,0.6)',
                  fontFamily: 'Inter',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Feature cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
          {features[activeTab].map((feature, idx) => {
            const Icon = feature.icon
            return (
              <div
                key={`${activeTab}-${idx}`}
                className={`glass rounded-3xl p-8 md:p-10 card-hover group relative overflow-hidden reveal-up delay-${(idx + 1) * 100}`}
              >
                {/* Background glow on hover */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"
                  style={{ background: 'radial-gradient(circle at 30% 30%, rgba(212,168,83,0.05) 0%, transparent 60%)' }}
                />

                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 relative z-10"
                  style={{ background: 'rgba(212, 168, 83, 0.1)', border: '1px solid rgba(212, 168, 83, 0.25)' }}
                >
                  <Icon size={20} style={{ color: '#D4A853' }} />
                </div>
                <h3
                  className="font-serif text-base font-semibold mb-2 relative z-10"
                  style={{ color: '#F0EDE8' }}
                >
                  {feature.title}
                </h3>
                <p
                  className="text-sm leading-relaxed relative z-10"
                  style={{ color: 'rgba(240, 237, 232, 0.6)', fontFamily: 'Inter' }}
                >
                  {feature.description}
                </p>

                <div
                  className="flex items-center gap-1 mt-4 text-xs font-medium relative z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: '#D4A853', fontFamily: 'Inter' }}
                >
                  Learn more <ChevronRight size={12} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Feature highlight image */}
        <div className="mt-16 grid lg:grid-cols-2 gap-10 xl:gap-14 items-center">
          <div>
            <div className="ar-badge inline-block mb-4">AR UI Showcase</div>
            <h3 className="font-serif text-3xl font-bold mb-4" style={{ color: '#F0EDE8' }}>
              A UI Built for the{' '}
              <span className="text-gold-gradient">Dining Experience</span>
            </h3>
            <p className="text-base leading-relaxed mb-6" style={{ color: 'rgba(240, 237, 232, 0.65)', fontFamily: 'Inter' }}>
              Every element — from the bottom menu drawer to the status bar — is designed for one-handed
              mobile use in a dimly lit restaurant environment.
            </p>
            <ul className="space-y-3">
              {[
                'Glassmorphic overlays with 24px blur',
                'Gold-accented AR tracking badges',
                'Animated tutorial gestures for new users',
                'Skeleton loaders while models download',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#D4A853' }} />
                  <span className="text-sm" style={{ color: 'rgba(240,237,232,0.7)', fontFamily: 'Inter' }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div
            className="relative rounded-2xl overflow-hidden gold-glow"
            style={{ height: '360px', border: '1px solid rgba(212,168,83,0.2)' }}
          >
            <img
              src="/ar_ui_overlay.png"
              alt="Paladeium AR UI interface"
              className="w-full h-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to bottom, transparent 60%, rgba(10,10,15,0.8) 100%)' }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
