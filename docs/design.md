# Paladeium Design Specification

This document outlines the visual and interaction design principles for the Paladeium AR Menu platform. Our goal is to provide a premium, frictionless, and "magical" experience for restaurant customers without requiring any app downloads.

---

## 🎨 Visual Identity

Paladeium's aesthetic is rooted in **Modern Luxury**. We combine a sleek dark interface with high-contrast gold accents to evoke a premium dining atmosphere.

### 1. Color Palette
| Token | Hex Code | Usage |
|---|---|---|
| **Gold** | `#D4A853` | Brand logo, active states, price tags, AR badges |
| **Gold Light** | `#F0C97A` | Hover states, highlights |
| **Dark (Base)** | `#0A0A0F` | Main background, splash screen |
| **Card BG** | `rgba(10, 10, 20, 0.82)` | Semi-transparent glassmorphic panels |
| **Text (Primary)** | `#F0EDE8` | Headings and primary content |
| **Muted** | `rgba(240, 237, 232, 0.55)` | Descriptions, secondary labels |
| **Border** | `rgba(212, 168, 83, 0.25)` | Subtle separators, card outlines |

### 2. Typography
- **Headings & Price**: `Playfair Display` (Serif) — Adds a touch of classic elegance and authority.
- **UI & Body**: `Inter` (Sans-Serif) — Ensures maximum readability and a clean, modern feel for technical elements.

---

## 🏛️ UI Architecture (AR Lens)

The AR Lens is designed for one-handed mobile use, with all critical controls positioned within the "thumb zone" at the bottom of the screen.

### 1. Splash Screen
The entry point of the application.
- **Logo**: Centered, high-contrast serif typography.
- **CTA**: A prominent gold "Open Menu" button that initiates the camera request.
- **Feel**: Minimalist, setting the stage for a premium experience.

### 2. Glassmorphism Design System
All UI overlays (Menu Panel, Info Card, Status Bar) use a consistent glassmorphic style:
- `backdrop-filter: blur(24px) saturate(160%)`
- Subtle `1px` border with low-opacity gold.
- High-saturation background to maintain readability over dynamic camera feeds.

### 3. The Bottom Menu Panel
A sliding drawer that houses the restaurant's menu.
- **Handle**: A simple bar at the top to indicate draggability.
- **Category Pills**: Horizontal scrollable list to filter items (e.g., "Starters", "Mains").
- **Dish Cards**: 2-column grid. Items with 3D models feature a distinct "AR" badge in the top-right corner.

### 4. Interactive Overlays
- **Status Bar**: Located at the top, showing the brand and the AR tracking status (Scanning vs. Found).
- **Skeleton Loaders**: While a 3D model is downloading, a skeleton card pulses in the center of the screen to manage user expectations and reduce perceived wait time.
- **Tutorial Overlay**: An animated hand gesture appears when the first model loads, teaching the user they can swipe to switch dishes.

---

## ✨ AR Interaction Model

The AR experience is designed to be immersive and stable.

### 1. Image Tracking (MindAR)
- **Anchor**: The physical menu card or coaster acts as the world anchor.
- **Stability**: High-pass filtering (`filterBeta: 1000`) is applied to prevent "jitter" and ensure the 3D dish feels "stuck" to the card.
- **Target Found/Lost**: The UI reacts instantly. If the card is lost, a subtle prompt appears asking the user to point the camera back at the card.

### 2. 3D Dish Manipulation
- **Default Scale**: Models are normalized to real-world size (~15-20cm wide).
- **Gestures**:
    - **Single Finger Drag**: Rotate the dish on its Y-axis.
    - **Pinch**: Scale the dish up or down (within safety limits).
    - **Horizontal Swipe (UI)**: Switches the active 3D model to the next available item in the menu.

---

## 📱 Performance & Optimization

- **Mobile First**: Optimized for iOS (Safari) and Android (Chrome).
- **Lazy Loading**: 3D models (`.glb`) are only fetched when a user selects a dish.
- **Assets**: Textures are compressed (KTX2 or Basis) and geometry is decimated to keep file sizes under 5MB per dish.
- **Transparency**: The UI uses `background: transparent !important` to ensure the camera feed is always visible behind the glassmorphic layers.
