# nexoraos

A glass-morphic desktop environment that runs in your browser with macOS-inspired design and complete file persistence.

![nexoraos Desktop](assets/nexoraos.png)

##  Try it

https://vibe-os-lac.vercel.app/

##  Features

- **Complete window management** — Drag, resize, minimize, maximize, and fullscreen windows with smooth animations
- **File system with persistence** — Create, rename, duplicate, and delete text files and folders that persist across sessions
- **Built-in applications** — Notes editor, file explorer, browser (Surf), settings, app store, terminal, and guide
- **Installable apps** — Calculator, Focus timer, and Weather app available from VibeStore
- **Desktop widgets** — Digital clock, analog clock, and calendar widgets you can place and resize
- **Theme customization** — Light and dark modes with multiple accent colors and wallpapers
- **Responsive dock** — Dynamic dock with app launcher and minimized window management
- **Smart layouts** — Auto-align desktop icons to grid with collision detection
- **Full keyboard shortcuts** — Ctrl+S to save, Ctrl+N for new file, and more
- **Browser preview** — Surf app lets you preview websites in embedded iframes
- **System controls** — Control center with Wi-Fi status, battery info, and brightness adjustment

##  How to run

1. Clone or download this repository
2. Open `index.html` in a modern browser (Chrome, Firefox, Edge, or Safari)
3. Click "Enter nexoraos" on the lock screen

No build process, no dependencies, no server required. Everything runs client-side.

##  How it works

nexoraos uses vanilla JavaScript with Web APIs for a native-like desktop experience. The window system uses CSS transforms and the Web Animations API for fluid minimize/restore animations that match macOS behavior. File persistence leverages localStorage with JSON serialization, while the dock implements a z-index stacking system for proper window focus management. Desktop icon positioning uses a spatial grid algorithm with collision detection to prevent overlaps. The glass-morphic UI applies CSS backdrop-filter with layered gradients and careful opacity tuning for depth.

##  Credits

- Icons by Lucide (https://lucide.dev)
- Fonts: Inter UI 
- Design inspiration: macOS Big Sur and later

---

Built with ❤️ using vanilla HTML, CSS, and JavaScript by VibeSlayer
