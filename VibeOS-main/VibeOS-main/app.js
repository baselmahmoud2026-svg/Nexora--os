// app api
const appApi = {
  layer: 10,
  apps: {},
  drag: null,
  resize: null,

  //--->create_app()
  createApp(appData) {
    this.register(appData.name, appData);
    dock.create.app(appData);
  },

  //--->register_app()
  register(name, appData = {}) {
    const windowEl = document.querySelector(`[data-app="${name}"]`);

    if (!windowEl) {
      return;
    }

    this.apps[name] = {
      windowEl,
      title: appData.title || windowEl.dataset.title || name,
      icon: appData.icon || windowEl.dataset.icon || "",
      iconName: appData.iconName || windowEl.dataset.iconName || "",
      iconText: appData.iconText || windowEl.dataset.iconText || name.charAt(0).toUpperCase(),
      system: Boolean(appData.system),
      minimized: false,
      previousRect: null,
      fullscreenRect: null,
      state: {},
    };

    this.bindOpeners(name);
    this.bindWindow(name);
    this.syncOpenState(name);
  },

  //--->bind_openers()
  bindOpeners(name) {
    document.querySelectorAll(`[data-open="${name}"]`).forEach((button) => {
      button.addEventListener("click", (event) => {
        if (button.classList.contains("desktop-icon") && desktopIconApi.shouldIgnoreClick()) {
          event.preventDefault();
          return;
        }

        if (this.apps[name].minimized) {
          this.restore(name);
          return;
        }

        this.open(name);
      });
    });
  },

  //--->bind_window()
  bindWindow(name) {
    const app = this.apps[name];
    const titleBar = app.windowEl.querySelector(".title-bar");

    app.windowEl.addEventListener("mousedown", () => this.focus(name));
    titleBar.addEventListener("mousedown", (event) => this.startDrag(event, name));
    this.addResizeHandles(name);

    app.windowEl.querySelectorAll("[data-window-action]").forEach((button) => {
      button.addEventListener("click", () => {
        this.runWindowAction(name, button.dataset.windowAction);
      });
    });
  },

  //--->open_app()
  open(name) {
    const app = this.apps[name];

    if (!app) {
      return;
    }

    app.windowEl.classList.add("open");
    app.windowEl.classList.remove("minimizing", "restoring", "closing", "fullscreening");
    app.minimized = false;
    dock.removeMinimized(name);
    this.focus(name);
    this.syncOpenState(name);
  },

  //--->close_app()
  close(name) {
    const app = this.apps[name];

    if (!app || app.windowEl.classList.contains("closing")) {
      return;
    }

    const finishClose = () => {
      app.windowEl.classList.remove("open", "minimizing", "restoring", "closing", "fullscreen", "fullscreening");
      app.windowEl.style.transform = "";
      app.windowEl.style.clipPath = "";
      app.windowEl.style.opacity = "";
      app.minimized = false;
      app.fullscreenRect = null;
      dock.removeMinimized(name);
      this.syncOpenState(name);
    };

    if (!app.windowEl.classList.contains("open")) {
      finishClose();
      return;
    }

    app.windowEl.classList.add("closing");
    app.windowEl.addEventListener("animationend", finishClose, { once: true });
  },

  //--->toggle_fullscreen()
  toggleFullscreen(name) {
    const app = this.apps[name];

    if (!app) {
      return;
    }

    const windowEl = app.windowEl;
    const isFullscreen = windowEl.classList.contains("fullscreen");
    const currentRect = this.getWindowRect(windowEl);

    windowEl.classList.add("fullscreening");
    windowEl.style.left = `${currentRect.left}px`;
    windowEl.style.top = `${currentRect.top}px`;
    windowEl.style.width = `${currentRect.width}px`;
    windowEl.style.height = `${currentRect.height}px`;
    windowEl.offsetHeight;

    window.setTimeout(() => {
      windowEl.classList.remove("fullscreening");
    }, 320);

    if (!isFullscreen) {
      app.fullscreenRect = currentRect;
      windowEl.classList.add("fullscreen");

      requestAnimationFrame(() => {
        windowEl.style.left = "14px";
        windowEl.style.top = "82px";
        windowEl.style.width = "calc(100vw - 28px)";
        windowEl.style.height = "calc(100vh - 96px)";
      });

      this.focus(name);
      return;
    }

    const rect = app.fullscreenRect;
    windowEl.classList.remove("fullscreen");

    if (rect) {
      requestAnimationFrame(() => {
        windowEl.style.left = `${rect.left}px`;
        windowEl.style.top = `${rect.top}px`;
        windowEl.style.width = `${rect.width}px`;
        windowEl.style.height = `${rect.height}px`;
      });

      window.setTimeout(() => {
        windowEl.style.height = "";
      }, 320);
    }

    app.fullscreenRect = null;
    this.focus(name);
  },

  //--->add_resize_handles()
  addResizeHandles(name) {
    const app = this.apps[name];

    if (!app || app.windowEl.querySelector(".window-resize-handle")) {
      return;
    }

    ["n", "e", "s", "w", "ne", "nw", "se", "sw"].forEach((edge) => {
      const handle = document.createElement("span");
      handle.className = `window-resize-handle resize-${edge}`;
      handle.dataset.resizeEdge = edge;
      handle.setAttribute("aria-hidden", "true");
      handle.addEventListener("mousedown", (event) => this.startResize(event, name, edge));
      app.windowEl.appendChild(handle);
    });
  },

  //--->center_app()
  center(name) {
    const app = this.apps[name];

    if (!app) {
      return;
    }

    const left = (window.innerWidth - app.windowEl.offsetWidth) / 2;
    const top = (window.innerHeight - app.windowEl.offsetHeight) / 2;

    app.windowEl.style.left = `${Math.max(8, left)}px`;
    app.windowEl.style.top = `${Math.max(76, top)}px`;
    this.focus(name);
  },

  //--->window_actions()
  runWindowAction(name, action) {
    const actions = {
      close: () => this.close(name),
      minimize: () => this.minimize(name),
      center: () => this.center(name),
      fullscreen: () => this.toggleFullscreen(name),
    };

    if (actions[action]) {
      actions[action]();
    }
  },

  //--->focus_app()
  focus(name) {
    const app = this.apps[name];

    if (!app) {
      return;
    }

    this.layer += 1;
    Object.values(this.apps).forEach((openApp) => {
      openApp.windowEl.classList.toggle("focused", openApp === app);
    });
    app.windowEl.style.zIndex = this.layer;
  },

  //--->sync_open_state()
  syncOpenState(name) {
    const app = this.apps[name];
    const isOpen = app.windowEl.classList.contains("open") && !app.minimized;

    document.querySelectorAll(`[data-open="${name}"]`).forEach((button) => {
      button.classList.toggle("app-open", isOpen);
    });
    dock.renderPinned();
  },

  //--->get_window_rect()
  getWindowRect(windowEl) {
    const rect = windowEl.getBoundingClientRect();

    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  },

  //--->animate_to_dock()
  animateToDock(app, dockIcon) {
    const windowRect = app.windowEl.getBoundingClientRect();
    const iconRect = dockIcon.getBoundingClientRect();
    const x = iconRect.left + iconRect.width / 2 - (windowRect.left + windowRect.width / 2);
    const y = iconRect.top + iconRect.height / 2 - (windowRect.top + windowRect.height / 2);
    const scale = Math.max(0.08, iconRect.width / windowRect.width);

    app.windowEl.classList.add("minimizing");

    return app.windowEl.animate(
      [
        {
          transform: "translate3d(0, 0, 0) scale(1)",
          clipPath: "inset(0 0 0 0 round 18px)",
          opacity: 1,
        },
        {
          transform: `translate3d(${x * 0.5}px, ${y * 0.55}px, 0) scale(${Math.max(scale * 2.4, 0.26)}, 0.62)`,
          clipPath: "inset(10% 2% 18% 2% round 28px)",
          opacity: 0.86,
        },
        {
          transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`,
          clipPath: "inset(42% 38% 42% 38% round 999px)",
          opacity: 0.18,
        },
      ],
      {
        duration: 520,
        easing: "cubic-bezier(.22, 1, .36, 1)",
        fill: "forwards",
      }
    ).finished;
  },

  //--->minimize_app()
  minimize(name) {
    const app = this.apps[name];

    if (!app || app.minimized || !app.windowEl.classList.contains("open")) {
      return;
    }

    app.previousRect = this.getWindowRect(app.windowEl);
    app.state.html = app.windowEl.querySelector(".window-body")?.innerHTML || "";

    const dockIcon = dock.addMinimized({
      id: name,
      title: app.title,
      icon: app.icon,
      iconName: app.iconName,
      iconText: app.iconText,
      pending: true,
    });

    this.animateToDock(app, dockIcon).then(() => {
      app.windowEl.classList.remove("open", "minimizing");
      app.windowEl.style.transform = "";
      app.windowEl.style.clipPath = "";
      app.windowEl.style.opacity = "";
      app.minimized = true;
      dock.showMinimized(name);
      this.syncOpenState(name);
    });
  },

  //--->restore_app()
  restore(name) {
    const app = this.apps[name];
    const dockIcon = dock.getIcon(name);

    if (!app || !app.minimized || !dockIcon) {
      this.open(name);
      return;
    }

    const dockRect = this.getWindowRect(dockIcon);
    dock.removeMinimized(name);

    const rect = app.previousRect || this.getWindowRect(app.windowEl);
    app.windowEl.style.left = `${rect.left}px`;
    app.windowEl.style.top = `${rect.top}px`;
    app.windowEl.style.width = `${rect.width}px`;
    app.windowEl.classList.add("open", "restoring");
    this.focus(name);

    this.animateFromDock(app, dockRect).then(() => {
      app.windowEl.classList.remove("restoring");
      app.windowEl.style.transform = "";
      app.windowEl.style.clipPath = "";
      app.windowEl.style.opacity = "";
      app.minimized = false;
      this.syncOpenState(name);
    });
  },

  //--->animate_from_dock()
  animateFromDock(app, dockIcon) {
    const windowRect = app.windowEl.getBoundingClientRect();
    const iconRect = dockIcon;
    const x = iconRect.left + iconRect.width / 2 - (windowRect.left + windowRect.width / 2);
    const y = iconRect.top + iconRect.height / 2 - (windowRect.top + windowRect.height / 2);
    const scale = Math.max(0.08, iconRect.width / windowRect.width);

    return app.windowEl.animate(
      [
        {
          transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`,
          clipPath: "inset(42% 38% 42% 38% round 999px)",
          opacity: 0.18,
        },
        {
          transform: `translate3d(${x * 0.5}px, ${y * 0.55}px, 0) scale(${Math.max(scale * 2.4, 0.26)}, 0.62)`,
          clipPath: "inset(10% 2% 18% 2% round 28px)",
          opacity: 0.86,
        },
        {
          transform: "translate3d(0, 0, 0) scale(1)",
          clipPath: "inset(0 0 0 0 round 18px)",
          opacity: 1,
        },
      ],
      {
        duration: 520,
        easing: "cubic-bezier(.22, 1, .36, 1)",
        fill: "forwards",
      }
    ).finished;
  },

  //--->start_drag() //todo fix instability
  startDrag(event, name) {
    if (event.button !== 0 || event.target.closest("button, .window-resize-handle")) {
      return;
    }

    const app = this.apps[name];
    const box = app.windowEl.getBoundingClientRect();

    if (app.windowEl.classList.contains("fullscreen")) {
      return;
    }

    this.focus(name);
    this.drag = {
      name,
      startX: event.clientX,
      startY: event.clientY,
      left: box.left,
      top: box.top,
    };

    document.body.classList.add("dragging");
  },

  //--->move_drag()
  moveDrag(event) {
    if (!this.drag) {
      return;
    }

    const app = this.apps[this.drag.name];
    const nextLeft = this.drag.left + event.clientX - this.drag.startX;
    const nextTop = this.drag.top + event.clientY - this.drag.startY;
    const maxLeft = window.innerWidth - app.windowEl.offsetWidth - 8;
    const maxTop = window.innerHeight - app.windowEl.offsetHeight - 8;

    app.windowEl.style.left = `${Math.max(8, Math.min(nextLeft, maxLeft))}px`;
    app.windowEl.style.top = `${Math.max(76, Math.min(nextTop, maxTop))}px`;
  },

  //--->stop_drag()
  stopDrag() {
    this.drag = null;
    document.body.classList.remove("dragging");
  },

  //--->start_resize()
  startResize(event, name, edge) {
    if (event.button !== 0) {
      return;
    }

    const app = this.apps[name];

    if (!app || app.windowEl.classList.contains("fullscreen")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.focus(name);

    const rect = app.windowEl.getBoundingClientRect();
    this.resize = {
      name,
      edge,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      minWidth: parseFloat(getComputedStyle(app.windowEl).minWidth) || 290,
      minHeight: parseFloat(getComputedStyle(app.windowEl).minHeight) || 220,
    };

    document.body.classList.add("resizing-window");
  },

  //--->move_resize()
  moveResize(event) {
    if (!this.resize) {
      return;
    }

    const data = this.resize;
    const app = this.apps[data.name];
    const dx = event.clientX - data.startX;
    const dy = event.clientY - data.startY;
    let left = data.left;
    let top = data.top;
    let width = data.width;
    let height = data.height;

    if (data.edge.includes("e")) {
      width = data.width + dx;
    }

    if (data.edge.includes("s")) {
      height = data.height + dy;
    }

    if (data.edge.includes("w")) {
      width = data.width - dx;
      left = data.left + dx;
    }

    if (data.edge.includes("n")) {
      height = data.height - dy;
      top = data.top + dy;
    }

    if (width < data.minWidth) {
      if (data.edge.includes("w")) {
        left -= data.minWidth - width;
      }
      width = data.minWidth;
    }

    if (height < data.minHeight) {
      if (data.edge.includes("n")) {
        top -= data.minHeight - height;
      }
      height = data.minHeight;
    }

    const maxWidth = window.innerWidth - 16;
    const maxHeight = window.innerHeight - 88;
    left = Math.max(8, Math.min(left, window.innerWidth - data.minWidth - 8));
    top = Math.max(76, Math.min(top, window.innerHeight - data.minHeight - 8));
    width = Math.min(width, maxWidth - left + 8);
    height = Math.min(height, maxHeight - top + 76);

    app.windowEl.style.left = `${left}px`;
    app.windowEl.style.top = `${top}px`;
    app.windowEl.style.width = `${width}px`;
    app.windowEl.style.height = `${height}px`;
  },

  //--->stop_resize()
  stopResize() {
    this.resize = null;
    document.body.classList.remove("resizing-window");
  },
};
// end app api

// desktop layout api
const desktopLayoutApi = {
  margin: 8,
  startX: 24,
  startY: 104,
  stepX: 100,
  stepY: 108,

  //--->get_desktop_items()
  getItems(exclude) {
    return Array.from(document.querySelectorAll(".desktop-icon, .desktop-file-icon"))
      .filter((item) => item !== exclude && item.offsetParent !== null);
  },

  //--->get_candidate_rect()
  getRect(element, x, y) {
    return {
      left: x,
      top: y,
      right: x + element.offsetWidth,
      bottom: y + element.offsetHeight,
    };
  },

  //--->rects_overlap()
  overlaps(first, second) {
    return !(
      first.right + this.margin < second.left ||
      first.left > second.right + this.margin ||
      first.bottom + this.margin < second.top ||
      first.top > second.bottom + this.margin
    );
  },

  //--->has_icon_collision()
  hasCollision(element, x, y) {
    const rect = this.getRect(element, x, y);

    return this.getItems(element).some((item) => this.overlaps(rect, item.getBoundingClientRect()));
  },

  //--->clamp_desktop_position()
  clamp(element, x, y) {
    return {
      x: Math.min(Math.max(8, x), Math.max(8, window.innerWidth - element.offsetWidth - 10)),
      y: Math.min(Math.max(8, y), Math.max(8, window.innerHeight - element.offsetHeight - 10)),
    };
  },

  //--->find_free_icon_spot()
  findFreeSpot(element, preferredX, preferredY) {
    const preferred = this.clamp(element, preferredX, preferredY);

    if (!this.hasCollision(element, preferred.x, preferred.y)) {
      return preferred;
    }

    const maxColumns = Math.max(1, Math.floor((window.innerWidth - this.startX) / this.stepX));
    const maxRows = Math.max(1, Math.ceil((window.innerHeight - this.startY) / this.stepY));
    const spots = [];

    for (let row = 0; row <= maxRows; row += 1) {
      for (let column = 0; column < maxColumns; column += 1) {
        const spot = this.clamp(element, this.startX + column * this.stepX, this.startY + row * this.stepY);
        spots.push({
          ...spot,
          distance: Math.hypot(spot.x - preferred.x, spot.y - preferred.y),
        });
      }
    }

    return spots
      .sort((first, second) => first.distance - second.distance)
      .find((spot) => !this.hasCollision(element, spot.x, spot.y)) || preferred;
  },
};
// end desktop layout api

// dock api
const dock = {
  apps: {},
  minimizedApps: [],
  pinnedApps: ["files", "browser", "notes", "settings", "vibestore", "terminal", "guide", "calculator", "focus", "weather"],

  create: {
    //--->dock.create.app()
    app(appData) {
      dock.apps[appData.name] = appData;
    },
  },

  //--->add_minimized_app()
  addMinimized(appData) {
    const existingApp = this.minimizedApps.find((app) => app.id === appData.id);

    if (!existingApp) {
      this.minimizedApps.push(appData);
    }

    this.render();
    return this.getIcon(appData.id);
  },

  //--->show_minimized_app()
  showMinimized(id) {
    const item = this.minimizedApps.find((app) => app.id === id);
    const icon = this.getIcon(id);

    if (item) {
      item.pending = false;
    }

    if (icon) {
      icon.classList.remove("pending");
      icon.classList.add("ready");
    }
  },

  //--->remove_minimized_app()
  removeMinimized(id) {
    this.minimizedApps = this.minimizedApps.filter((app) => app.id !== id);
    this.render();
  },

  //--->get_minimized_apps()
  getMinimizedApps() {
    return this.minimizedApps;
  },

  //--->get_dock_icon()
  getIcon(id) {
    return document.querySelector(`[data-dock-app="${id}"]`);
  },

  //--->is_app_visible_in_main_dock()
  shouldShowPinned(id) {
    const app = this.apps[id] || appApi.apps[id];

    if (!app) {
      return false;
    }

    if (app.system) {
      return true;
    }

    return typeof installApi !== "undefined" && installApi.isInstalled(id);
  },

  //--->add_dock_icon_content()
  addIconContent(button, appData) {
    if (appData.icon) {
      const image = document.createElement("img");
      image.src = appData.icon;
      image.alt = "";
      button.appendChild(image);
      return;
    }

    if (appData.iconName) {
      const icon = document.createElement("i");
      icon.dataset.lucide = appData.iconName;
      icon.setAttribute("aria-hidden", "true");
      button.appendChild(icon);
      button.classList.add("generated-dock-icon");
      return;
    }

    button.textContent = appData.iconText || appData.title.charAt(0).toUpperCase();
    button.classList.add("text-dock-icon");
  },

  //--->render_main_dock()
  renderPinned() {
    const dockEl = document.getElementById("mainDock");

    if (!dockEl) {
      return;
    }

    dockEl.innerHTML = "";

    this.pinnedApps.filter((id) => this.shouldShowPinned(id)).forEach((id) => {
      const app = appApi.apps[id];
      const button = document.createElement("button");
      const isOpen = app.windowEl.classList.contains("open") && !app.minimized;
      const isMinimized = this.minimizedApps.some((item) => item.id === id);

      button.className = "main-dock-icon";
      button.type = "button";
      button.title = app.title;
      button.dataset.mainDockApp = id;
      button.dataset.open = id;
      button.classList.toggle("active", isOpen);
      button.classList.toggle("minimized", isMinimized);
      this.addIconContent(button, app);
      button.addEventListener("click", () => {
        if (app.minimized) {
          appApi.restore(id);
          return;
        }

        appApi.open(id);
      });

      dockEl.appendChild(button);
    });

    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  //--->render_dock()
  render() {
    const dockEl = document.getElementById("dockApps");

    dockEl.innerHTML = "";
    dockEl.classList.toggle("has-minimized", this.minimizedApps.length > 0);

    this.minimizedApps.forEach((appData) => {
      const button = document.createElement("button");

      button.className = "dock-icon";
      button.type = "button";
      button.title = appData.title;
      button.dataset.dockApp = appData.id;
      button.classList.toggle("pending", appData.pending);

      this.addIconContent(button, appData);

      button.addEventListener("click", () => appApi.restore(appData.id));
      dockEl.appendChild(button);
    });

    this.renderPinned();
  },
};
// end dock api

// widget api
const widgetApi = {
  layer: document.getElementById("widgetLayer"),
  hint: document.getElementById("placementHint"),
  menu: document.getElementById("widgetMenu"),
  widgets: [],
  count: 0,
  drag: null,
  placementType: null,

  //--->add_widget()
  add(type, position) {
    const id = `widget-${Date.now()}`;
    const widget = document.createElement("article");

    widget.className = `widget ${type}-widget`;
    widget.classList.add("size-medium");
    widget.dataset.widget = id;
    widget.style.left = `${Math.max(8, Math.min(position.x, window.innerWidth - 230))}px`;
    widget.style.top = `${Math.max(8, Math.min(position.y, window.innerHeight - 190))}px`;
    widget.innerHTML = this.getTemplate(type);

    this.layer.appendChild(widget);
    this.widgets.push({ id, type, element: widget });
    this.bind(widget, type);
    this.updateClockWidgets();
  },

  //--->start_widget_placement()
  startPlacement(type) {
    this.placementType = type;
    document.body.classList.add("placement-mode");
  },

  //--->place_widget()
  place(event) {
    if (!this.placementType) {
      return;
    }

    if (event.target.closest(".top-island, .system-dock, .system-panel, .window, .context-menu, .modal-backdrop, .desktop-icon, .desktop-file-icon, .widget")) {
      return;
    }

    event.preventDefault();
    this.add(this.placementType, { x: event.clientX - 95, y: event.clientY - 55 });
    this.stopPlacement();
  },

  //--->stop_widget_placement()
  stopPlacement() {
    this.placementType = null;
    document.body.classList.remove("placement-mode");
  },

  //--->widget_template()
  getTemplate(type) {
    if (type === "calendar") {
      return this.getCalendarTemplate();
    }

    if (type === "analog-clock") {
      return this.getAnalogClockTemplate();
    }

    return `
      <p class="clock-display" data-clock-display>--:--</p>
      <p class="clock-date" data-clock-date>Loading date</p>
    `;
  },

  //--->analog_clock_template()
  getAnalogClockTemplate() {
    const ticks = Array.from({ length: 12 }, (_, index) => {
      return `<span class="clock-tick" style="--tick-rotate: ${index * 30}deg"></span>`;
    }).join("");

    return `
      <div class="analog-clock-face" data-analog-clock>
        ${ticks}
        <span class="clock-hand hour" data-clock-hour></span>
        <span class="clock-hand minute" data-clock-minute></span>
        <span class="clock-hand second" data-clock-second></span>
      </div>
      <p class="clock-date" data-clock-date>Loading date</p>
    `;
  },

  //--->calendar_template()
  getCalendarTemplate() {
    const now = new Date();
    const month = now.toLocaleString([], { month: "long" });
    const year = now.getFullYear();
    const days = new Date(year, now.getMonth() + 1, 0).getDate();
    const firstDay = new Date(year, now.getMonth(), 1).getDay();
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      .map((day) => `<span class="weekday">${day}</span>`)
      .join("");
    const blanks = Array.from({ length: firstDay }, () => `<span class="calendar-empty"></span>`).join("");
    const cells = Array.from({ length: days }, (_, index) => {
      const day = index + 1;
      const className = day === now.getDate() ? "today" : "";

      return `<span class="${className}">${day}</span>`;
    }).join("");

    return `
      <p class="calendar-month">${month} ${year}</p>
      <div class="calendar-grid">${weekdays}${blanks}${cells}</div>
    `;
  },

  //--->bind_widget()
  bind(widget, type) {
    widget.addEventListener("mousedown", (event) => this.startDrag(event, widget));
    widget.addEventListener("contextmenu", (event) => this.openMenu(event, widget));
  },

  //--->remove_widget()
  remove(widget) {
    this.widgets = this.widgets.filter((item) => item.element !== widget);
    widget.remove();
  },

  //--->clear_widgets()
  clear() {
    this.widgets.forEach((item) => item.element.remove());
    this.widgets = [];
  },

  //--->start_widget_drag()
  startDrag(event, widget) {
    if (event.target.closest("button") || widget.classList.contains("locked")) {
      return;
    }

    const rect = widget.getBoundingClientRect();

    this.drag = {
      widget,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
    };
  },

  //--->move_widget_drag()
  moveDrag(event) {
    if (!this.drag) {
      return;
    }

    const nextLeft = this.drag.left + event.clientX - this.drag.startX;
    const nextTop = this.drag.top + event.clientY - this.drag.startY;

    this.drag.widget.style.left = `${Math.max(8, Math.min(nextLeft, window.innerWidth - 80))}px`;
    this.drag.widget.style.top = `${Math.max(8, Math.min(nextTop, window.innerHeight - 80))}px`;
  },

  //--->stop_widget_drag()
  stopDrag() {
    this.drag = null;
  },

  //--->open_widget_menu()
  openMenu(event, widget) {
    event.preventDefault();
    event.stopPropagation();
    this.activeWidget = widget;
    this.menu.style.left = `${Math.min(event.clientX, window.innerWidth - 205)}px`;
    this.menu.style.top = `${Math.min(event.clientY, window.innerHeight - 190)}px`;
    this.menu.classList.add("open");
    this.updateMenuText();
    contextMenuApi.close();
  },

  //--->close_widget_menu()
  closeMenu() {
    this.menu.classList.remove("open");
  },

  //--->update_widget_menu()
  updateMenuText() {
    const lockButton = this.menu.querySelector('[data-widget-action="toggle-lock"] span');

    if (lockButton && this.activeWidget) {
      lockButton.textContent = this.activeWidget.classList.contains("locked") ? "Unlock widget" : "Lock widget";
    }
  },

  //--->set_widget_size()
  setSize(size) {
    if (!this.activeWidget || this.activeWidget.classList.contains("locked")) {
      return;
    }

    this.activeWidget.classList.remove("size-small", "size-medium", "size-large");
    this.activeWidget.classList.add(`size-${size}`);
  },

  //--->toggle_widget_lock()
  toggleLock() {
    if (this.activeWidget) {
      this.activeWidget.classList.toggle("locked");
    }
  },

  //--->bind_widget_menu()
  bindMenu() {
    this.menu.addEventListener("click", (event) => {
      const action = event.target.closest("button")?.dataset.widgetAction;

      if (action === "toggle-lock") {
        this.toggleLock();
      }

      if (["small", "medium", "large"].includes(action)) {
        this.setSize(action);
      }

      if (action === "remove" && this.activeWidget && !this.activeWidget.classList.contains("locked")) {
        this.remove(this.activeWidget);
      }

      this.closeMenu();
    });
  },

  //--->update_clock_widgets()
  updateClockWidgets() {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const seconds = now.getSeconds();
    const minutes = now.getMinutes();
    const hours = now.getHours() % 12;
    const secondRotation = seconds * 6;
    const minuteRotation = minutes * 6 + seconds * 0.1;
    const hourRotation = hours * 30 + minutes * 0.5;
    const date = now.toLocaleDateString([], {
      weekday: "long",
      month: "short",
      day: "numeric",
    });

    document.querySelectorAll("[data-clock-display]").forEach((clock) => {
      clock.textContent = time;
    });

    document.querySelectorAll("[data-clock-date]").forEach((dateText) => {
      dateText.textContent = date;
    });

    document.querySelectorAll("[data-analog-clock]").forEach((clock) => {
      clock.style.setProperty("--hour-rotation", `${hourRotation}deg`);
      clock.style.setProperty("--minute-rotation", `${minuteRotation}deg`);
      clock.style.setProperty("--second-rotation", `${secondRotation}deg`);
    });
  },
};
// end widget api

// file system api
const fileSystemApi = {
  key: "nexoraos-files",
  positionKey: "nexoraos-desktop-file-positions",
  desktopLayer: document.getElementById("desktopFiles"),
  fileMenu: document.getElementById("fileMenu"),
  roots: {
    desktop: "Desktop",
    documents: "Documents",
    downloads: "Downloads",
  },
  items: [],
  currentFolder: "desktop",
  selectedId: null,
  menuItemId: null,
  editingId: null,
  desktopPositions: {},
  desktopDrag: null,
  ignoreDesktopClickUntil: 0,

  //--->load_files()
  load() {
    try {
      const savedFiles = JSON.parse(localStorage.getItem(this.key) || "[]");
      this.items = Array.isArray(savedFiles) ? savedFiles : [];
    } catch (error) {
      this.items = [];
    }

    try {
      this.desktopPositions = JSON.parse(localStorage.getItem(this.positionKey) || "{}");
    } catch (error) {
      this.desktopPositions = {};
    }
  },

  //--->save_files()
  save() {
    localStorage.setItem(this.key, JSON.stringify(this.items));
  },

  //--->save_desktop_file_positions()
  saveDesktopPositions() {
    localStorage.setItem(this.positionKey, JSON.stringify(this.desktopPositions));
  },

  //--->show_files_app()
  showFilesApp() {
    if (appApi.apps.files?.minimized) {
      appApi.restore("files");
      return;
    }

    appApi.open("files");
  },

  //--->get_file_item()
  getItem(id) {
    return this.items.find((item) => item.id === id);
  },

  //--->open_folder()
  openFolder(folderId) {
    this.currentFolder = folderId;
    this.selectedId = null;
    this.render();
  },

  //--->create_file()
  createFile(parent = this.currentFolder, openFiles = true) {
    this.createItem("file", parent, openFiles);
  },

  //--->create_folder()
  createFolder(parent = this.currentFolder, openFiles = true) {
    this.createItem("folder", parent, openFiles);
  },

  //--->create_item()
  createItem(type, parent, openFiles) {
    const baseName = type === "folder" ? "New Folder" : "New File.txt";
    const item = {
      id: `file-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type,
      name: this.getUniqueName(baseName, parent),
      parent,
      content: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.items.push(item);
    this.selectedId = item.id;
    this.save();

    if (openFiles) {
      this.currentFolder = parent;
    }

    this.render();

    if (openFiles) {
      this.showFilesApp();
    }
  },

  //--->create_text_file()
  createTextFile(name, content, parent = "desktop") {
    const item = {
      id: `file-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type: "file",
      name: this.getUniqueName(name, parent),
      parent,
      content,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.items.push(item);
    this.selectedId = item.id;
    this.save();
    this.render();
    return item;
  },

  //--->go_back_folder()
  goBack() {
    if (this.roots[this.currentFolder]) {
      return;
    }

    const folder = this.items.find((item) => item.id === this.currentFolder);
    this.openFolder(folder?.parent || "desktop");
  },

  //--->get_unique_file_name()
  getUniqueName(baseName, parent, ignoreId = "") {
    const usedNames = this.items
      .filter((item) => item.parent === parent && item.id !== ignoreId)
      .map((item) => item.name.toLowerCase());

    if (!usedNames.includes(baseName.toLowerCase())) {
      return baseName;
    }

    const extensionIndex = baseName.lastIndexOf(".");
    const hasExtension = extensionIndex > 0;
    const name = hasExtension ? baseName.slice(0, extensionIndex) : baseName;
    const extension = hasExtension ? baseName.slice(extensionIndex) : "";
    let count = 2;

    while (usedNames.includes(`${name} ${count}${extension}`.toLowerCase())) {
      count += 1;
    }

    return `${name} ${count}${extension}`;
  },

  //--->get_current_items()
  getCurrentItems() {
    return this.items
      .filter((item) => item.parent === this.currentFolder)
      .sort((first, second) => {
        if (first.type !== second.type) {
          return first.type === "folder" ? -1 : 1;
        }

        return first.name.localeCompare(second.name);
      });
  },

  //--->get_folder_title()
  getFolderTitle() {
    if (this.roots[this.currentFolder]) {
      return this.roots[this.currentFolder];
    }

    return this.items.find((item) => item.id === this.currentFolder)?.name || "Files";
  },

  //--->get_current_root()
  getCurrentRoot() {
    let folderId = this.currentFolder;

    while (!this.roots[folderId]) {
      const folder = this.items.find((item) => item.id === folderId);

      if (!folder) {
        return "desktop";
      }

      folderId = folder.parent;
    }

    return folderId;
  },

  //--->select_file()
  select(id) {
    this.selectedId = id;
    this.syncSelection();
  },

  //--->sync_file_selection()
  syncSelection() {
    const selectedItem = this.getItem(this.selectedId);
    const selectedName = document.getElementById("selectedFileName");

    document.querySelectorAll("[data-file-id]").forEach((button) => {
      button.classList.toggle("selected", button.dataset.fileId === this.selectedId);
    });

    document.querySelectorAll("[data-desktop-file-id]").forEach((button) => {
      button.classList.toggle("selected", button.dataset.desktopFileId === this.selectedId);
    });

    document.querySelectorAll('[data-file-action$="-selected"]').forEach((button) => {
      button.disabled = !this.selectedId;
    });

    if (selectedName) {
      selectedName.textContent = selectedItem ? selectedItem.name : "Nothing selected";
    }
  },

  //--->open_file_item()
  openItem(id) {
    const item = this.getItem(id);

    if (!item) {
      return;
    }

    this.selectedId = id;

    if (item.type === "folder") {
      this.openFolder(item.id);
      this.showFilesApp();
      return;
    }

    this.openFile(item);
  },

  //--->is_text_file()
  isTextFile(item) {
    return item.type === "file" && item.name.toLowerCase().endsWith(".txt");
  },

  //--->open_file()
  openFile(item) {
    if (this.isTextFile(item)) {
      notesApi.openFile(item);
      return;
    }

    notesApi.openFile(item);
  },

  //--->rename_file_item()
  renameItem(id) {
    const item = this.getItem(id);

    if (!item) {
      return;
    }

    this.selectedId = item.id;
    this.editingId = item.id;
    this.render();
    this.focusRenameInput(item.id);
  },

  //--->focus_rename_input()
  focusRenameInput(id) {
    window.setTimeout(() => {
      const input = document.querySelector(`[data-rename-id="${id}"]`);

      if (!input) {
        return;
      }

      const dotIndex = input.value.lastIndexOf(".");
      const end = dotIndex > 0 ? dotIndex : input.value.length;
      input.focus();
      input.setSelectionRange(0, end);
    }, 0);
  },

  //--->commit_rename()
  commitRename(id, nextName) {
    const item = this.getItem(id);
    const cleanName = nextName.trim();

    if (!item) {
      return;
    }

    if (cleanName) {
      item.name = this.getUniqueName(cleanName, item.parent, item.id);
      item.updatedAt = Date.now();
      this.save();
    }

    this.editingId = null;
    this.selectedId = item.id;
    this.render();
  },

  //--->cancel_rename()
  cancelRename() {
    this.editingId = null;
    this.render();
  },

  //--->delete_file_item()
  deleteItem(id) {
    const item = this.getItem(id);

    if (!item) {
      return;
    }

    const deletedIds = this.getDescendantIds(id);
    this.items = this.items.filter((fileItem) => !deletedIds.includes(fileItem.id));

    if (deletedIds.includes(this.currentFolder)) {
      this.currentFolder = item.parent || "desktop";
    }

    if (deletedIds.includes(this.selectedId)) {
      this.selectedId = null;
    }

    deletedIds.forEach((deletedId) => delete this.desktopPositions[deletedId]);
    this.saveDesktopPositions();
    this.save();
    this.render();
  },

  //--->duplicate_file_item()
  duplicateItem(id) {
    const item = this.getItem(id);

    if (!item) {
      return;
    }

    const copyRoot = this.copyItem(item, item.parent);
    this.selectedId = copyRoot.id;
    this.save();
    this.render();
  },

  //--->copy_file_item()
  copyItem(item, parent) {
    const copy = {
      ...item,
      id: `file-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: this.getUniqueName(this.getCopyName(item.name), parent),
      parent,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.items.push(copy);

    if (item.type === "folder") {
      this.items
        .filter((child) => child.parent === item.id)
        .forEach((child) => this.copyItem(child, copy.id));
    }

    return copy;
  },

  //--->get_copy_name()
  getCopyName(name) {
    const extensionIndex = name.lastIndexOf(".");

    if (extensionIndex <= 0) {
      return `${name} copy`;
    }

    return `${name.slice(0, extensionIndex)} copy${name.slice(extensionIndex)}`;
  },

  //--->get_descendant_ids()
  getDescendantIds(id) {
    const ids = [id];
    const children = this.items.filter((item) => item.parent === id);

    children.forEach((child) => {
      ids.push(...this.getDescendantIds(child.id));
    });

    return ids;
  },

  //--->run_file_action()
  runAction(action, id = this.selectedId) {
    const actions = {
      open: () => this.openItem(id),
      rename: () => this.renameItem(id),
      duplicate: () => this.duplicateItem(id),
      delete: () => this.deleteItem(id),
    };

    if (actions[action] && id) {
      actions[action]();
    }

    this.closeFileMenu();
  },

  //--->render_files()
  render() {
    const grid = document.getElementById("filesGrid");
    const count = document.getElementById("fileCount");
    const title = document.querySelector(".files-toolbar h3");
    const backButton = document.querySelector('[data-file-action="back"]');
    const selectedName = document.getElementById("selectedFileName");

    if (!grid || !count || !title) {
      return;
    }

    const items = this.getCurrentItems();
    const currentRoot = this.getCurrentRoot();
    title.textContent = this.getFolderTitle();
    count.textContent = `${items.length} ${items.length === 1 ? "item" : "items"}`;
    grid.innerHTML = "";

    document.querySelectorAll("[data-file-root]").forEach((button) => {
      button.classList.toggle("active", button.dataset.fileRoot === currentRoot);
    });

    if (backButton) {
      backButton.disabled = Boolean(this.roots[this.currentFolder]);
    }

    document.querySelectorAll('[data-file-action$="-selected"]').forEach((button) => {
      button.disabled = !this.selectedId;
    });

    if (selectedName) {
      const selectedItem = this.getItem(this.selectedId);
      selectedName.textContent = selectedItem ? selectedItem.name : "Nothing selected";
    }

    if (items.length === 0) {
      const emptyState = document.createElement("p");
      emptyState.className = "files-empty";
      emptyState.textContent = "This folder is empty";
      grid.appendChild(emptyState);
      this.renderDesktop();
      return;
    }

    items.forEach((item) => {
      const button = document.createElement("button");
      const icon = this.getIconElement(item);

      button.className = "file-item";
      button.type = "button";
      button.dataset.fileId = item.id;
      button.classList.toggle("selected", item.id === this.selectedId);

      button.append(icon, this.getNameElement(item));
      grid.appendChild(button);
    });

    this.renderDesktop();
  },

  //--->render_desktop_files()
  renderDesktop() {
    if (!this.desktopLayer) {
      return;
    }

    const desktopItems = this.items
      .filter((item) => item.parent === "desktop")
      .sort((first, second) => first.name.localeCompare(second.name));

    this.desktopLayer.innerHTML = "";

    desktopItems.forEach((item) => {
      const button = document.createElement("button");
      const icon = this.getIconElement(item);
      const position = this.getDesktopPosition(item, desktopItems.indexOf(item));
      const savedPosition = this.desktopPositions[item.id];

      button.className = "desktop-file-icon";
      button.type = "button";
      button.dataset.desktopFileId = item.id;
      button.classList.toggle("selected", item.id === this.selectedId);
      button.style.left = `${position.x}px`;
      button.style.top = `${position.y}px`;

      button.append(icon, this.getNameElement(item, "strong"));
      this.desktopLayer.appendChild(button);

      const finalPosition = savedPosition
        ? desktopLayoutApi.clamp(button, position.x, position.y)
        : desktopLayoutApi.findFreeSpot(button, position.x, position.y);
      button.style.left = `${finalPosition.x}px`;
      button.style.top = `${finalPosition.y}px`;

      if (!savedPosition || savedPosition.x !== finalPosition.x || savedPosition.y !== finalPosition.y) {
        this.desktopPositions[item.id] = finalPosition;
      }
    });

    this.saveDesktopPositions();
  },

  //--->get_desktop_file_position()
  getDesktopPosition(item, index) {
    return this.desktopPositions[item.id] || {
      x: 128 + (index % 3) * 92,
      y: 104 + Math.floor(index / 3) * 104,
    };
  },

  //--->get_file_icon_element()
  getIconElement(item) {
    const icon = document.createElement("span");

    icon.className = `file-icon ${item.type}`;

    if (item.type === "folder") {
      const image = document.createElement("img");
      image.src = "assets/folder.png";
      image.alt = "";
      icon.appendChild(image);
      return icon;
    }

    const glyph = document.createElement("span");
    glyph.className = "file-glyph";
    glyph.setAttribute("aria-hidden", "true");
    glyph.innerHTML = "<span></span><span></span><span></span>";
    icon.appendChild(glyph);
    return icon;
  },

  //--->get_file_name_element()
  getNameElement(item, tagName = "span") {
    if (this.editingId !== item.id) {
      const name = document.createElement(tagName);
      name.className = "file-name";
      name.textContent = item.name;
      return name;
    }

    const input = document.createElement("input");
    input.className = "file-name rename-input";
    input.dataset.renameId = item.id;
    input.value = item.name;
    input.spellcheck = false;
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("dblclick", (event) => event.stopPropagation());
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.commitRename(item.id, input.value);
      }

      if (event.key === "Escape") {
        event.preventDefault();
        this.cancelRename();
      }
    });
    input.addEventListener("blur", () => this.commitRename(item.id, input.value));

    return input;
  },

  //--->open_file_menu()
  openFileMenu(event, id) {
    event.preventDefault();
    event.stopPropagation();
    this.menuItemId = id;
    this.selectedId = id;
    this.render();
    this.fileMenu.style.left = `${Math.min(event.clientX, window.innerWidth - 190)}px`;
    this.fileMenu.style.top = `${Math.min(event.clientY, window.innerHeight - 170)}px`;
    this.fileMenu.classList.add("open");
    contextMenuApi.close();
  },

  //--->close_file_menu()
  closeFileMenu() {
    this.fileMenu.classList.remove("open");
  },

  //--->should_ignore_desktop_file_click()
  shouldIgnoreDesktopClick() {
    return Date.now() < this.ignoreDesktopClickUntil;
  },

  //--->start_desktop_file_drag()
  startDesktopDrag(event, button) {
    if (event.button !== 0 || event.target.closest("input, textarea, select")) {
      return;
    }

    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);

    const rect = button.getBoundingClientRect();

    this.desktopDrag = {
      button,
      id: button.dataset.desktopFileId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
      moved: false,
    };

    button.classList.add("dragging-file");
  },

  //--->move_desktop_file_drag()
  moveDesktopDrag(event) {
    if (!this.desktopDrag || event.pointerId !== this.desktopDrag.pointerId) {
      return;
    }

    event.preventDefault();

    const dx = event.clientX - this.desktopDrag.startX;
    const dy = event.clientY - this.desktopDrag.startY;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      this.desktopDrag.moved = true;
    }

    const maxLeft = window.innerWidth - this.desktopDrag.button.offsetWidth - 10;
    const maxTop = window.innerHeight - this.desktopDrag.button.offsetHeight - 10;
    const left = Math.min(Math.max(8, this.desktopDrag.left + dx), Math.max(8, maxLeft));
    const top = Math.min(Math.max(8, this.desktopDrag.top + dy), Math.max(8, maxTop));

    this.desktopDrag.button.style.left = `${left}px`;
    this.desktopDrag.button.style.top = `${top}px`;
  },

  //--->get_folder_drop_target()
  getFolderDropTarget(button) {
    button.style.pointerEvents = "none";
    const rect = button.getBoundingClientRect();
    const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    button.style.pointerEvents = "";

    const folderButton = target?.closest("[data-desktop-file-id]");
    const folder = folderButton ? this.getItem(folderButton.dataset.desktopFileId) : null;

    if (!folder || folder.type !== "folder" || folder.id === button.dataset.desktopFileId) {
      return null;
    }

    return folder;
  },

  //--->stop_desktop_file_drag()
  stopDesktopDrag() {
    if (!this.desktopDrag) {
      return;
    }

    const button = this.desktopDrag.button;

    button.releasePointerCapture?.(this.desktopDrag.pointerId);
    button.classList.remove("dragging-file");

    if (this.desktopDrag.moved) {
      const folder = this.getFolderDropTarget(button);

      if (folder) {
        const item = this.getItem(this.desktopDrag.id);

        if (item) {
          item.parent = folder.id;
          item.updatedAt = Date.now();
          delete this.desktopPositions[item.id];
          this.ignoreDesktopClickUntil = Date.now() + 180;
          this.desktopDrag = null;
          this.save();
          this.saveDesktopPositions();
          this.render();
          return;
        }
      }

      const position = desktopLayoutApi.findFreeSpot(
        button,
        parseFloat(button.style.left) || 128,
        parseFloat(button.style.top) || 104
      );

      button.style.left = `${position.x}px`;
      button.style.top = `${position.y}px`;
      this.desktopPositions[this.desktopDrag.id] = {
        x: position.x,
        y: position.y,
      };
      this.ignoreDesktopClickUntil = Date.now() + 180;
      this.saveDesktopPositions();
    }

    this.desktopDrag = null;
  },

  //--->bind_file_app()
  bind() {
    document.querySelectorAll("[data-file-root]").forEach((button) => {
      button.addEventListener("click", () => this.openFolder(button.dataset.fileRoot));
    });

    document.querySelectorAll("[data-file-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.fileAction;

        if (action === "back") {
          this.goBack();
        }

        if (action === "new-folder") {
          this.createFolder();
        }

        if (action === "new-file") {
          this.createFile();
        }

        if (action === "open-selected") {
          this.runAction("open");
        }

        if (action === "rename-selected") {
          this.runAction("rename");
        }

        if (action === "duplicate-selected") {
          this.runAction("duplicate");
        }

        if (action === "delete-selected") {
          this.runAction("delete");
        }
      });
    });

    document.getElementById("filesGrid")?.addEventListener("click", (event) => {
      const itemButton = event.target.closest("[data-file-id]");

      if (!itemButton) {
        return;
      }

      this.select(itemButton.dataset.fileId);
    });

    document.getElementById("filesGrid")?.addEventListener("dblclick", (event) => {
      const itemButton = event.target.closest("[data-file-id]");

      if (itemButton) {
        this.openItem(itemButton.dataset.fileId);
      }
    });

    document.getElementById("filesGrid")?.addEventListener("contextmenu", (event) => {
      const itemButton = event.target.closest("[data-file-id]");

      if (itemButton) {
        this.openFileMenu(event, itemButton.dataset.fileId);
      }
    });

    this.desktopLayer?.addEventListener("click", (event) => {
      const itemButton = event.target.closest("[data-desktop-file-id]");

      if (itemButton) {
        if (this.shouldIgnoreDesktopClick()) {
          event.preventDefault();
          return;
        }

        this.select(itemButton.dataset.desktopFileId);
      }
    });

    this.desktopLayer?.addEventListener("dblclick", (event) => {
      const itemButton = event.target.closest("[data-desktop-file-id]");

      if (itemButton) {
        if (this.shouldIgnoreDesktopClick()) {
          event.preventDefault();
          return;
        }

        this.openItem(itemButton.dataset.desktopFileId);
      }
    });

    this.desktopLayer?.addEventListener("pointerdown", (event) => {
      const itemButton = event.target.closest("[data-desktop-file-id]");

      if (itemButton) {
        this.startDesktopDrag(event, itemButton);
      }
    });

    this.desktopLayer?.addEventListener("contextmenu", (event) => {
      const itemButton = event.target.closest("[data-desktop-file-id]");

      if (itemButton) {
        this.openFileMenu(event, itemButton.dataset.desktopFileId);
      }
    });

    this.fileMenu.addEventListener("click", (event) => {
      const action = event.target.closest("button")?.dataset.fileMenuAction;

      if (action) {
        this.runAction(action, this.menuItemId);
      }
    });
  },
};
// end file system api

// notes api
const notesApi = {
  key: "nexoraos-notes-draft",
  editor: document.getElementById("noteEditor"),
  title: document.getElementById("notesWindowTitle"),
  fileName: document.getElementById("noteFileName"),
  saveState: document.getElementById("noteSaveState"),
  position: document.getElementById("notePosition"),
  count: document.getElementById("noteCount"),
  currentFileId: null,
  dirty: false,
  wrap: true,

  //--->load_note()
  load() {
    try {
      const savedNote = JSON.parse(localStorage.getItem(this.key) || "{}");
      this.editor.value = savedNote.content || "";
      this.wrap = savedNote.wrap !== false;
    } catch (error) {
      this.editor.value = "";
      this.wrap = true;
    }

    this.applyWrap();
    this.setDirty(false);
    this.updateTitle();
    this.updateStats();
  },

  //--->save_note()
  save() {
    const file = fileSystemApi.getItem(this.currentFileId);

    if (file) {
      file.content = this.editor.value;
      file.updatedAt = Date.now();
      fileSystemApi.save();
      fileSystemApi.render();
    } else {
      localStorage.setItem(
        this.key,
        JSON.stringify({
          content: this.editor.value,
          wrap: this.wrap,
        })
      );
    }

    this.setDirty(false);
    this.updateTitle();
  },

  //--->new_note()
  newNote() {
    this.currentFileId = null;
    this.editor.value = "";
    this.save();
    this.editor.focus();
    this.updateStats();
  },

  //--->open_note_file()
  openFile(file) {
    this.currentFileId = file.id;
    this.editor.value = file.content || "";
    this.setDirty(false);
    this.updateTitle();
    this.updateStats();

    if (appApi.apps.notes?.minimized) {
      appApi.restore("notes");
    } else {
      appApi.open("notes");
    }

    this.editor.focus();
  },

  //--->save_note_to_desktop()
  saveToDesktop() {
    const file = fileSystemApi.getItem(this.currentFileId);

    if (file) {
      this.save();
      return;
    }

    const newFile = fileSystemApi.createTextFile("Untitled.txt", this.editor.value);
    this.currentFileId = newFile.id;
    this.setDirty(false);
    this.updateTitle();
  },

  //--->toggle_word_wrap()
  toggleWrap() {
    this.wrap = !this.wrap;
    this.applyWrap();
    this.save();
  },

  //--->apply_word_wrap()
  applyWrap() {
    this.editor.classList.toggle("no-wrap", !this.wrap);

    document.querySelectorAll('[data-note-action="toggle-wrap"]').forEach((button) => {
      button.classList.toggle("active", this.wrap);
    });
  },

  //--->set_note_dirty()
  setDirty(isDirty) {
    this.dirty = isDirty;
    this.saveState.textContent = isDirty ? "Unsaved" : "Saved";
  },

  //--->get_note_name()
  getName() {
    return fileSystemApi.getItem(this.currentFileId)?.name || "Untitled";
  },

  //--->update_note_title()
  updateTitle() {
    const name = this.getName();
    const marker = this.dirty ? "* " : "";

    this.fileName.textContent = name;
    this.title.textContent = `${marker}${name} - Notepad`;
  },

  //--->update_note_stats()
  updateStats() {
    const cursor = this.editor.selectionStart;
    const beforeCursor = this.editor.value.slice(0, cursor);
    const lines = beforeCursor.split("\n");
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    const length = this.editor.value.length;

    this.position.textContent = `Ln ${line}, Col ${column}`;
    this.count.textContent = `${length} ${length === 1 ? "character" : "characters"}`;
  },

  //--->run_note_action()
  runAction(action) {
    const actions = {
      new: () => this.newNote(),
      save: () => this.save(),
      "save-desktop": () => this.saveToDesktop(),
      "toggle-wrap": () => this.toggleWrap(),
    };

    if (actions[action]) {
      actions[action]();
    }
  },

  //--->bind_notes()
  bind() {
    document.querySelectorAll("[data-note-action]").forEach((button) => {
      button.addEventListener("click", () => this.runAction(button.dataset.noteAction));
    });

    this.editor.addEventListener("input", () => {
      this.setDirty(true);
      this.updateTitle();
      this.updateStats();
    });

    this.editor.addEventListener("click", () => this.updateStats());
    this.editor.addEventListener("keyup", () => this.updateStats());

    this.editor.addEventListener("keydown", (event) => {
      if (event.ctrlKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        this.save();
      }

      if (event.ctrlKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        this.newNote();
      }
    });
  },
};
// end notes api

// Browser api
const BrowserApi = {
  tabList: document.getElementById("BrowserTabList"),
  frame: document.getElementById("BrowserFrame"),
  address: document.getElementById("BrowserAddress"),
  startInput: document.getElementById("BrowserStartSearch"),
  status: document.getElementById("BrowserStatus"),
  progress: document.getElementById("BrowserProgress"),
  startPage: document.getElementById("BrowserStartPage"),
  errorState: document.getElementById("BrowserErrorState"),
  tabs: [],
  activeTabId: "",
  loadingTimer: null,
  statusTimer: null,
  fallbackUrl: "Browser://start",

  //--->get_active_Browser_tab()
  get activeTab() {
    return this.tabs.find((tab) => tab.id === this.activeTabId) || null;
  },

  //--->clean_Browser_url()
  cleanUrl(value) {
    const typed = value.trim();

    if (!typed) {
      return "";
    }

    if (typed.includes(" ") || !typed.includes(".")) {
      return `https://www.bing.com/search?q=${encodeURIComponent(typed)}`;
    }

    if (/^https?:\/\//i.test(typed)) {
      return typed;
    }

    return `https://${typed}`;
  },

  //--->set_Browser_status()
  setStatus(text) {
    if (!this.status) {
      return;
    }

    window.clearTimeout(this.statusTimer);
    this.status.textContent = text;
    this.status.classList.add("show");
    this.status.setAttribute("aria-hidden", "false");

    this.statusTimer = window.setTimeout(() => {
      this.status.classList.remove("show");
      this.status.setAttribute("aria-hidden", "true");
    }, 3600);
  },

  //--->set_Browser_loading()
  setLoading(isLoading) {
    this.progress?.classList.toggle("loading", isLoading);
    this.frame?.classList.toggle("loading", isLoading);
  },

  //--->create_Browser_tab()
  createTab(url = "", switchToTab = true) {
    const tab = {
      id: `Browser-tab-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title: "New Tab",
      url: "",
      history: [this.fallbackUrl],
      index: 0,
    };

    this.tabs.push(tab);

    if (switchToTab) {
      this.activeTabId = tab.id;
      this.renderTabs();
      if (url) {
        this.load(url);
      } else {
        this.showHome(false);
      }
    } else {
      this.renderTabs();
    }

    return tab;
  },

  //--->get_Browser_tab_title()
  getTitle(url) {
    if (!url) {
      return "New Tab";
    }

    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch (error) {
      return "Browser";
    }
  },

  //--->render_Browser_tabs()
  renderTabs() {
    if (!this.tabList) {
      return;
    }

    this.tabList.innerHTML = "";

    this.tabs.forEach((tab) => {
      const button = document.createElement("button");
      const title = document.createElement("span");
      const close = document.createElement("span");

      button.type = "button";
      button.className = "Browser-tab";
      button.classList.toggle("active", tab.id === this.activeTabId);
      button.dataset.BrowserTab = tab.id;

      title.textContent = tab.title;
      close.className = "Browser-tab-close";
      close.textContent = "x";
      close.dataset.BrowserCloseTab = tab.id;
      close.setAttribute("aria-label", `Close ${tab.title}`);

      button.append(title, close);
      this.tabList.appendChild(button);
    });

    this.updateButtons();
  },

  //--->switch_Browser_tab()
  switchTab(id) {
    const tab = this.tabs.find((item) => item.id === id);

    if (!tab) {
      return;
    }

    this.activeTabId = tab.id;
    this.renderTabs();

    if (!tab.url) {
      this.showHome(false);
      return;
    }

    this.load(tab.url, false);
  },

  //--->close_Browser_tab()
  closeTab(id) {
    if (this.tabs.length <= 1) {
      this.showHome(false);
      return;
    }

    const index = this.tabs.findIndex((tab) => tab.id === id);

    if (index === -1) {
      return;
    }

    const wasActive = this.tabs[index].id === this.activeTabId;
    this.tabs.splice(index, 1);

    if (wasActive) {
      const nextTab = this.tabs[Math.max(0, index - 1)];
      this.activeTabId = nextTab.id;
      this.switchTab(nextTab.id);
      return;
    }

    this.renderTabs();
  },

  //--->show_Browser_home()
  showHome(push = true) {
    const tab = this.activeTab;

    if (!tab) {
      return;
    }

    window.clearTimeout(this.loadingTimer);
    tab.url = "";
    tab.title = "New Tab";
    this.address.value = "";
    this.startInput.value = "";
    this.setLoading(false);
    this.startPage?.classList.remove("hidden");
    this.errorState?.classList.remove("show");
    this.errorState?.setAttribute("aria-hidden", "true");
    this.frame?.classList.remove("show");
    this.frame?.removeAttribute("src");

    if (push) {
      tab.history = tab.history.slice(0, tab.index + 1);
      tab.history.push(this.fallbackUrl);
      tab.index = tab.history.length - 1;
    }

    this.renderTabs();
    this.updateButtons();
  },

  //--->load_Browser_url()
  load(value, push = true) {
    const tab = this.activeTab;
    const url = this.cleanUrl(value);

    if (!tab || !this.frame || !this.address) {
      return;
    }

    if (!url || url === this.fallbackUrl) {
      this.showHome(push);
      return;
    }

    if (push) {
      tab.history = tab.history.slice(0, tab.index + 1);
      tab.history.push(url);
      tab.index = tab.history.length - 1;
    }

    window.clearTimeout(this.loadingTimer);
    tab.url = url;
    tab.title = this.getTitle(url);
    this.address.value = url;
    this.startPage?.classList.add("hidden");
    this.errorState?.classList.remove("show");
    this.errorState?.setAttribute("aria-hidden", "true");
    this.frame.classList.remove("show");
    this.setLoading(true);
    this.setStatus("Loading preview...");
    this.frame.src = url;
    this.loadingTimer = window.setTimeout(() => this.showError(), 8500);
    this.renderTabs();
    this.updateButtons();
  },

  //--->move_Browser_history()
  go(delta) {
    const tab = this.activeTab;

    if (!tab) {
      return;
    }

    const nextIndex = tab.index + delta;

    if (nextIndex < 0 || nextIndex >= tab.history.length) {
      return;
    }

    tab.index = nextIndex;
    const item = tab.history[tab.index];

    if (item === this.fallbackUrl) {
      this.showHome(false);
      return;
    }

    this.load(item, false);
  },

  //--->reload_Browser()
  reload() {
    const tab = this.activeTab;

    if (tab?.url) {
      this.load(tab.history[tab.index], false);
      return;
    }

    this.showHome(false);
  },

  //--->show_Browser_error()
  showError() {
    if (!this.activeTab?.url) {
      return;
    }

    this.setLoading(false);
    this.frame?.classList.remove("show");
    this.startPage?.classList.add("hidden");
    this.errorState?.classList.add("show");
    this.errorState?.setAttribute("aria-hidden", "false");
  },

  //--->update_Browser_buttons()
  updateButtons() {
    const tab = this.activeTab;

    document.querySelector('[data-Browser-action="back"]')?.toggleAttribute("disabled", !tab || tab.index <= 0);
    document.querySelector('[data-Browser-action="forward"]')?.toggleAttribute("disabled", !tab || tab.index >= tab.history.length - 1);
  },

  //--->bind_Browser()
  bind() {
    document.querySelector("[data-Browser-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      this.load(this.address.value);
    });

    document.querySelector("[data-Browser-start-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      this.load(this.startInput.value);
    });

    document.querySelectorAll("[data-Browser-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.BrowserAction;

        if (action === "back") {
          this.go(-1);
        }

        if (action === "forward") {
          this.go(1);
        }

        if (action === "reload") {
          this.reload();
        }

        if (action === "home") {
          this.showHome();
        }

        if (action === "new-tab") {
          this.createTab();
        }

        if (action === "external" && this.activeTab?.url) {
          window.open(this.activeTab.url, "_blank", "noopener,noreferrer");
        }

        if (action === "retry") {
          this.reload();
        }
      });
    });

    this.tabList?.addEventListener("click", (event) => {
      const close = event.target.closest("[data-Browser-close-tab]");
      const tab = event.target.closest("[data-Browser-tab]");

      if (close) {
        event.stopPropagation();
        this.closeTab(close.dataset.BrowserCloseTab);
        return;
      }

      if (tab) {
        this.switchTab(tab.dataset.BrowserTab);
      }
    });

    this.frame?.addEventListener("load", () => {
      if (!this.activeTab?.url) {
        return;
      }

      window.clearTimeout(this.loadingTimer);
      this.setLoading(false);
      this.errorState?.classList.remove("show");
      this.errorState?.setAttribute("aria-hidden", "true");
      this.frame.classList.add("show");
      this.setStatus("Preview loaded · Some sites may block embeds");
    });

    this.frame?.addEventListener("error", () => this.showError());

    this.createTab();
  },
};
// end Browser api

// install api
const installApi = {
  key: "nexoraos-installed-apps",
  installed: [],
  installing: new Set(),
  apps: {
    calculator: {
      title: "Calculator",
      icon: "assets/calculator.png",
    },
    focus: {
      title: "Focus",
      icon: "assets/focus.png",
    },
  },

  //--->load_installed_apps()
  load() {
    try {
      this.installed = JSON.parse(localStorage.getItem(this.key) || "[]");
      this.installed = this.installed.filter((name) => this.apps[name]);
    } catch (error) {
      this.installed = [];
    }
  },

  //--->save_installed_apps()
  save() {
    localStorage.setItem(this.key, JSON.stringify(this.installed));
  },

  //--->is_app_installed()
  isInstalled(name) {
    return this.installed.includes(name);
  },

  //--->can_uninstall_app()
  canUninstall(name) {
    return Boolean(this.apps[name]);
  },

  //--->install_app()
  install(name) {
    if (!this.apps[name]) {
      return;
    }

    if (this.isInstalled(name)) {
      appApi.open(name);
      return;
    }

    if (this.installing.has(name)) {
      return;
    }

    this.installing.add(name);
    this.sync();

    window.setTimeout(() => this.finishInstall(name), 1400);
  },

  //--->finish_install_app()
  finishInstall(name) {
    if (!this.isInstalled(name)) {
      this.installed.push(name);
      this.save();
    }

    this.installing.delete(name);
    this.sync();
    desktopIconApi.alignIcons();
    dock.renderPinned();
    appApi.open(name);
  },

  //--->uninstall_app()
  uninstall(name) {
    if (!this.canUninstall(name)) {
      return;
    }

    this.installing.delete(name);
    this.installed = this.installed.filter((appName) => appName !== name);
    this.save();
    appApi.close(name);
    dock.removeMinimized(name);
    delete desktopIconApi.icons[name];
    desktopIconApi.save();
    this.sync();
    dock.renderPinned();
  },

  //--->sync_installed_apps()
  sync() {
    document.querySelectorAll("[data-installable-app]").forEach((icon) => {
      const installed = this.isInstalled(icon.dataset.installableApp);
      icon.hidden = !installed;
    });

    document.querySelectorAll("[data-store-app]").forEach((card) => {
      const name = card.dataset.storeApp;
      const installed = this.isInstalled(name);
      const installing = this.installing.has(name);
      const button = card.querySelector("[data-install-app]");

      card.classList.toggle("installed", installed);
      card.classList.toggle("installing", installing);

      if (button) {
        button.textContent = installing ? "Installing" : installed ? "Open" : "Install";
        button.dataset.installed = installed ? "true" : "false";
        button.disabled = installing;
      }
    });

    dock.renderPinned();
    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  //--->bind_store_installs()
  bind() {
    document.querySelectorAll("[data-install-app]").forEach((button) => {
      button.addEventListener("click", () => {
        const name = button.dataset.installApp;

        this.install(name);
      });
    });
  },
};
// end install api

// calculator api
const calculatorApi = {
  display: document.getElementById("calculatorDisplay"),
  current: "0",
  stored: null,
  operator: null,
  waitingForNumber: false,

  //--->update_calculator_display()
  update() {
    if (this.display) {
      this.display.textContent = this.current;
    }
  },

  //--->format_calculator_value()
  format(value) {
    if (!Number.isFinite(value)) {
      return "Error";
    }

    const rounded = Number.parseFloat(value.toPrecision(12));
    return String(rounded).slice(0, 14);
  },

  //--->input_calculator_number()
  inputNumber(value) {
    if (this.current === "Error" || this.waitingForNumber) {
      this.current = value;
      this.waitingForNumber = false;
      this.update();
      return;
    }

    this.current = this.current === "0" ? value : `${this.current}${value}`;
    this.update();
  },

  //--->input_calculator_decimal()
  inputDecimal() {
    if (this.current === "Error" || this.waitingForNumber) {
      this.current = "0.";
      this.waitingForNumber = false;
      this.update();
      return;
    }

    if (!this.current.includes(".")) {
      this.current += ".";
      this.update();
    }
  },

  //--->choose_calculator_operator()
  chooseOperator(operator) {
    if (this.operator && !this.waitingForNumber) {
      this.calculate();
    }

    this.stored = Number(this.current);
    this.operator = operator;
    this.waitingForNumber = true;
  },

  //--->calculate_result()
  calculate() {
    if (!this.operator || this.stored === null) {
      return;
    }

    const next = Number(this.current);
    const operations = {
      "+": this.stored + next,
      "-": this.stored - next,
      "*": this.stored * next,
      "/": next === 0 ? Number.NaN : this.stored / next,
    };

    this.current = this.format(operations[this.operator]);
    this.stored = null;
    this.operator = null;
    this.waitingForNumber = true;
    this.update();
  },

  //--->run_calculator_action()
  runAction(action) {
    if (action === "clear") {
      this.current = "0";
      this.stored = null;
      this.operator = null;
      this.waitingForNumber = false;
    }

    if (action === "decimal") {
      this.inputDecimal();
      return;
    }

    if (action === "equals") {
      this.calculate();
      return;
    }

    if (action === "percent") {
      this.current = this.format(Number(this.current) / 100);
    }

    if (action === "sign" && this.current !== "0" && this.current !== "Error") {
      this.current = this.current.startsWith("-") ? this.current.slice(1) : `-${this.current}`;
    }

    this.update();
  },

  //--->bind_calculator()
  bind() {
    document.querySelectorAll("[data-calc-value]").forEach((button) => {
      button.addEventListener("click", () => this.inputNumber(button.dataset.calcValue));
    });

    document.querySelectorAll("[data-calc-operator]").forEach((button) => {
      button.addEventListener("click", () => this.chooseOperator(button.dataset.calcOperator));
    });

    document.querySelectorAll("[data-calc-action]").forEach((button) => {
      button.addEventListener("click", () => this.runAction(button.dataset.calcAction));
    });

    this.update();
  },
};
// end calculator api

// desktop icon api
const desktopIconApi = {
  key: "nexoraos-desktop-icon-positions",
  icons: {},
  drag: null,
  ignoreClickUntil: 0,
  defaults: {
    notes: { x: 24, y: 104 },
    browser: { x: 24, y: 208 },
    files: { x: 24, y: 312 },
    settings: { x: 24, y: 416 },
    vibestore: { x: 24, y: 520 },
    calculator: { x: 128, y: 520 },
    focus: { x: 128, y: 104 },
    weather: { x: 128, y: 208 },
    terminal: { x: 128, y: 312 },
    guide: { x: 128, y: 416 },
  },

  //--->load_desktop_icons()
  load() {
    try {
      this.icons = JSON.parse(localStorage.getItem(this.key) || "{}");
    } catch (error) {
      this.icons = {};
    }
  },

  //--->save_desktop_icons()
  save() {
    localStorage.setItem(this.key, JSON.stringify(this.icons));
  },

  //--->get_icon_position()
  getPosition(name, index) {
    return this.icons[name] || this.defaults[name] || { x: 24, y: 104 + index * 104 };
  },

  //--->apply_desktop_icon_positions()
  apply() {
    document.querySelectorAll(".desktop-icon").forEach((icon, index) => {
      if (icon.hidden || icon.offsetParent === null) {
        return;
      }

      const name = icon.dataset.open;
      const position = this.getPosition(name, index);
      const savedPosition = this.icons[name];
      const finalPosition = savedPosition
        ? desktopLayoutApi.clamp(icon, position.x, position.y)
        : desktopLayoutApi.findFreeSpot(icon, position.x, position.y);

      icon.style.left = `${finalPosition.x}px`;
      icon.style.top = `${finalPosition.y}px`;

      if (savedPosition && (savedPosition.x !== finalPosition.x || savedPosition.y !== finalPosition.y)) {
        this.icons[name] = finalPosition;
        this.save();
      }
    });
  },

  //--->auto_align_desktop_icons()
  alignIcons() {
    const icons = Array.from(document.querySelectorAll(".desktop-icon, .desktop-file-icon"))
      .filter((icon) => !icon.hidden && icon.offsetParent !== null);
    const startX = 24;
    const startY = 104;
    const gapX = 104;
    const gapY = 104;
    const maxRows = Math.max(1, Math.floor((window.innerHeight - startY - 24) / gapY));

    icons.forEach((icon, index) => {
      const column = Math.floor(index / maxRows);
      const row = index % maxRows;
      const x = startX + column * gapX;
      const y = startY + row * gapY;

      icon.style.left = `${x}px`;
      icon.style.top = `${y}px`;

      if (icon.classList.contains("desktop-icon")) {
        this.icons[icon.dataset.open] = { x, y };
      }

      if (icon.classList.contains("desktop-file-icon")) {
        fileSystemApi.desktopPositions[icon.dataset.desktopFileId] = { x, y };
      }
    });

    this.save();
    fileSystemApi.saveDesktopPositions();
  },

  //--->should_ignore_icon_click()
  shouldIgnoreClick() {
    return Date.now() < this.ignoreClickUntil;
  },

  //--->start_icon_drag()
  start(event, icon) {
    if (event.button !== 0 || event.target.closest("input, textarea, select")) {
      return;
    }

    event.preventDefault();
    icon.setPointerCapture?.(event.pointerId);

    const rect = icon.getBoundingClientRect();

    this.drag = {
      icon,
      name: icon.dataset.open,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
      moved: false,
      pointerId: event.pointerId,
    };

    icon.classList.add("dragging-icon");
  },

  //--->move_icon_drag()
  move(event) {
    if (!this.drag || event.pointerId !== this.drag.pointerId) {
      return;
    }

    event.preventDefault();
    const dx = event.clientX - this.drag.startX;
    const dy = event.clientY - this.drag.startY;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      this.drag.moved = true;
    }

    const maxLeft = window.innerWidth - this.drag.icon.offsetWidth - 10;
    const maxTop = window.innerHeight - this.drag.icon.offsetHeight - 10;
    const left = Math.min(Math.max(8, this.drag.left + dx), Math.max(8, maxLeft));
    const top = Math.min(Math.max(8, this.drag.top + dy), Math.max(8, maxTop));

    this.drag.icon.style.left = `${left}px`;
    this.drag.icon.style.top = `${top}px`;
  },

  //--->stop_icon_drag()
  stop() {
    if (!this.drag) {
      return;
    }

    const icon = this.drag.icon;

    icon.releasePointerCapture?.(this.drag.pointerId);
    icon.classList.remove("dragging-icon");

    if (this.drag.moved) {
      const position = desktopLayoutApi.findFreeSpot(
        icon,
        parseFloat(icon.style.left) || 24,
        parseFloat(icon.style.top) || 104
      );

      icon.style.left = `${position.x}px`;
      icon.style.top = `${position.y}px`;
      this.icons[this.drag.name] = {
        x: position.x,
        y: position.y,
      };
      this.ignoreClickUntil = Date.now() + 180;
      this.save();
    }

    this.drag = null;
  },

  //--->bind_desktop_icons()
  bind() {
    document.querySelectorAll(".desktop-icon").forEach((icon) => {
      icon.addEventListener("pointerdown", (event) => this.start(event, icon));
      icon.addEventListener("dragstart", (event) => event.preventDefault());
    });
  },
};
// end desktop icon api

// context menu api
const contextMenuApi = {
  menu: document.getElementById("contextMenu"),
  appMenu: document.getElementById("appMenu"),
  modal: document.getElementById("customizeModal"),
  point: { x: 120, y: 120 },
  appTarget: null,

  //--->open_context_menu()
  open(event) {
    const appIcon = event.target.closest(".desktop-icon");

    if (appIcon) {
      this.openAppMenu(event, appIcon);
      return;
    }

    if (event.target.closest(".window, .top-island, .system-dock, .system-panel, .context-menu")) {
      return;
    }

    event.preventDefault();
    this.point = { x: event.clientX, y: event.clientY };
    this.closeAppMenu();
    this.menu.style.left = `${Math.min(event.clientX, window.innerWidth - 225)}px`;
    this.menu.style.top = `${Math.min(event.clientY, window.innerHeight - 170)}px`;
    this.menu.classList.add("open");
  },

  //--->open_app_icon_menu()
  openAppMenu(event, icon) {
    const name = icon.dataset.open;
    const uninstallButton = this.appMenu.querySelector('[data-app-menu-action="uninstall"]');
    const canUninstall = installApi.canUninstall(name);

    event.preventDefault();
    this.close();
    fileSystemApi.closeFileMenu();
    this.appTarget = name;
    this.appMenu.style.left = `${Math.min(event.clientX, window.innerWidth - 205)}px`;
    this.appMenu.style.top = `${Math.min(event.clientY, window.innerHeight - 120)}px`;
    this.appMenu.classList.add("open");

    uninstallButton.disabled = !canUninstall;
    uninstallButton.querySelector("span").textContent = canUninstall ? "Uninstall" : "System app";
  },

  //--->close_context_menu()
  close() {
    this.menu.classList.remove("open");
  },

  //--->close_app_icon_menu()
  closeAppMenu() {
    this.appMenu.classList.remove("open");
    this.appTarget = null;
  },

  //--->open_customize_modal()
  openCustomize() {
    this.modal.classList.add("open");
    this.modal.setAttribute("aria-hidden", "false");
  },

  //--->close_customize_modal()
  closeCustomize() {
    this.modal.classList.remove("open");
    this.modal.setAttribute("aria-hidden", "true");
  },

  //--->sort_icons()
  sortIcons() {
    const iconGrid = document.querySelector(".desktop-icons");
    const icons = Array.from(iconGrid.querySelectorAll(".desktop-icon"));

    icons
      .sort((first, second) => {
        return first.textContent.trim().localeCompare(second.textContent.trim());
      })
      .forEach((icon) => iconGrid.appendChild(icon));
  },

  //--->bind_context_menu()
  bind() {
    document.addEventListener("contextmenu", (event) => this.open(event));
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".context-menu")) {
        this.close();
        this.closeAppMenu();
        fileSystemApi.closeFileMenu();
      }
    });

    this.appMenu.addEventListener("click", (event) => {
      const action = event.target.closest("button")?.dataset.appMenuAction;

      if (!action || !this.appTarget) {
        return;
      }

      if (action === "open") {
        appApi.open(this.appTarget);
      }

      if (action === "uninstall") {
        installApi.uninstall(this.appTarget);
      }

      this.closeAppMenu();
    });

    this.menu.addEventListener("click", (event) => {
      const action = event.target.closest("button")?.dataset.action;

      if (action === "toggle-icons") {
        document.querySelector(".desktop").classList.toggle("icons-hidden");
      }

      if (action === "sort-icons") {
        this.sortIcons();
      }

      if (action === "auto-align-icons") {
        desktopIconApi.alignIcons();
      }

      if (action === "new-file") {
        fileSystemApi.createFile("desktop", false);
      }

      if (action === "new-folder") {
        fileSystemApi.createFolder("desktop", false);
      }

      if (action === "customize-desktop") {
        this.openCustomize();
      }

      this.close();
    });

    this.modal.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      const widgetType = button?.dataset.modalWidget;
      const action = button?.dataset.modalAction || button?.dataset.action;

      if (event.target === this.modal || action === "close-customize") {
        this.closeCustomize();
      }

      if (widgetType) {
        this.closeCustomize();
        widgetApi.startPlacement(widgetType);
      }

      if (action === "clear-widgets") {
        widgetApi.clear();
      }

      if (action === "toggle-wordmark") {
        document.querySelector(".desktop").classList.toggle("wordmark-hidden");
      }

    });
  },
};
// end context menu api

// settings api
const settingsApi = {
  key: "nexoraos-settings",
  defaults: {
    theme: "light",
    background: "meadow",
    accent: "#226a78",
    dockSize: "cozy",
    customBackground: "",
  },
  state: {},
  mediaQuery: window.matchMedia?.("(prefers-color-scheme: dark)"),
  lastDark: null,
  lastBackground: null,

  //--->load_settings()
  load() {
    try {
      this.state = {
        ...this.defaults,
        ...JSON.parse(localStorage.getItem(this.key) || "{}"),
      };
    } catch (error) {
      this.state = { ...this.defaults };
    }
  },

  //--->save_settings()
  save() {
    localStorage.setItem(this.key, JSON.stringify(this.state));
  },

  //--->set_theme()
  setTheme(theme) {
    const wasDark = this.isDark();
    this.state.theme = theme;
    this.apply(wasDark, this.lastBackground);
    this.save();
  },

  //--->set_background()
  setBackground(background) {
    const previousBackground = this.state.background;
    this.state.background = background;
    this.apply(this.lastDark, previousBackground);
    this.save();
  },

  //--->set_custom_background()
  setCustomBackground(url) {
    const nextUrl = url.trim();

    if (!nextUrl) {
      return;
    }

    this.state.customBackground = nextUrl;
    this.setBackground("custom");
  },

  //--->set_accent()
  setAccent(accent) {
    this.state.accent = accent;
    this.apply(this.lastDark, this.lastBackground);
    this.save();
  },

  //--->set_dock_size()
  setDockSize(size) {
    this.state.dockSize = size;
    this.apply(this.lastDark, this.lastBackground);
    this.save();
  },

  //--->is_dark_theme()
  isDark() {
    return this.state.theme === "dark" || (this.state.theme === "system" && this.mediaQuery?.matches);
  },

  //--->apply_settings()
  apply(previousDark = this.lastDark, previousBackground = this.lastBackground) {
    const body = document.body;
    const root = document.documentElement;
    const isDark = this.isDark();

    body.classList.toggle("theme-dark", isDark);
    body.classList.toggle("theme-light", !isDark);
    body.dataset.background = this.state.background;
    body.dataset.dockSize = this.state.dockSize;
    root.style.setProperty("--accent", this.state.accent);
    root.style.setProperty("--accent-soft", `${this.state.accent}24`);

    if (this.state.customBackground) {
      root.style.setProperty("--custom-bg-image", `url("${this.state.customBackground.replace(/"/g, "%22")}")`);
    }

    this.syncControls();
    this.lastDark = isDark;
    this.lastBackground = this.state.background;
  },

  //--->sync_settings_controls()
  syncControls() {
    document.querySelectorAll("[data-setting-theme]").forEach((button) => {
      button.classList.toggle("active", button.dataset.settingTheme === this.state.theme);
    });

    document.querySelectorAll("[data-background-choice]").forEach((button) => {
      button.classList.toggle("active", button.dataset.backgroundChoice === this.state.background);
    });

    document.querySelectorAll("[data-setting-accent]").forEach((button) => {
      button.classList.toggle("active", button.dataset.settingAccent.toLowerCase() === this.state.accent.toLowerCase());
    });

    document.querySelectorAll("[data-setting-dock-size]").forEach((button) => {
      button.classList.toggle("active", button.dataset.settingDockSize === this.state.dockSize);
    });

    const customInput = document.getElementById("customBackgroundInput");

    if (customInput) {
      customInput.value = this.state.customBackground;
    }
  },

  //--->show_settings_section()
  showSection(section) {
    document.querySelectorAll("[data-settings-section]").forEach((button) => {
      button.classList.toggle("active", button.dataset.settingsSection === section);
    });

    document.querySelectorAll("[data-settings-pane]").forEach((pane) => {
      pane.classList.toggle("active", pane.dataset.settingsPane === section);
    });
  },

  //--->bind_settings()
  bind() {
    document.querySelectorAll("[data-settings-section]").forEach((button) => {
      button.addEventListener("click", () => this.showSection(button.dataset.settingsSection));
    });

    document.querySelectorAll("[data-setting-theme]").forEach((button) => {
      button.addEventListener("click", () => this.setTheme(button.dataset.settingTheme));
    });

    document.querySelectorAll("[data-background-choice]").forEach((button) => {
      button.addEventListener("click", () => this.setBackground(button.dataset.backgroundChoice));
    });

    document.querySelectorAll("[data-setting-accent]").forEach((button) => {
      button.addEventListener("click", () => this.setAccent(button.dataset.settingAccent));
    });

    document.querySelectorAll("[data-setting-dock-size]").forEach((button) => {
      button.addEventListener("click", () => this.setDockSize(button.dataset.settingDockSize));
    });

    document.querySelector("[data-setting-custom-background]")?.addEventListener("click", () => {
      this.setCustomBackground(document.getElementById("customBackgroundInput")?.value || "");
    });

    document.querySelector("[data-setting-toggle-icons]")?.addEventListener("click", () => {
      document.querySelector(".desktop")?.classList.toggle("icons-hidden");
    });

    this.mediaQuery?.addEventListener?.("change", () => {
      if (this.state.theme === "system") {
        this.apply(this.lastDark, this.lastBackground);
      }
    });

    this.apply();
  },
};
// end settings api

// focus api
const focusApi = {
  total: 25 * 60,
  remaining: 25 * 60,
  timer: null,
  time: document.getElementById("focusTime"),
  state: document.getElementById("focusState"),
  ring: document.getElementById("focusRing"),

  //--->format_focus_time()
  format(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  },

  //--->update_focus()
  update(label = "Ready") {
    if (this.time) {
      this.time.textContent = this.format(this.remaining);
    }

    if (this.state) {
      this.state.textContent = label;
    }

    if (this.ring) {
      const progress = 1 - this.remaining / this.total;
      this.ring.style.setProperty("--focus-progress", `${Math.round(progress * 360)}deg`);
    }
  },

  //--->start_focus()
  start() {
    if (this.timer) {
      return;
    }

    this.update("Focusing");
    this.timer = window.setInterval(() => {
      this.remaining = Math.max(0, this.remaining - 1);
      this.update(this.remaining ? "Focusing" : "Complete");

      if (!this.remaining) {
        this.pause();
      }
    }, 1000);
  },

  //--->pause_focus()
  pause() {
    window.clearInterval(this.timer);
    this.timer = null;
    this.update(this.remaining === this.total ? "Ready" : "Paused");
  },

  //--->reset_focus()
  reset() {
    this.pause();
    this.remaining = this.total;
    this.update("Ready");
  },

  //--->bind_focus()
  bind() {
    document.querySelectorAll("[data-focus-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.focusAction;

        if (action === "start") this.start();
        if (action === "pause") this.pause();
        if (action === "reset") this.reset();
      });
    });

    this.update();
  },
};
// end focus api

// terminal api
const terminalApi = {
  output: document.getElementById("terminalOutput"),
  form: document.getElementById("terminalForm"),
  input: document.getElementById("terminalInput"),
  prompt: document.getElementById("terminalPrompt"),
  cwd: "~",
  history: [],
  historyIndex: 0,

  escape(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    })[char]);
  },

  print(value = "", className = "") {
    if (!this.output) {
      return;
    }

    const line = document.createElement("div");
    line.className = `terminal-line ${className}`.trim();
    line.innerHTML = this.escape(value).replace(/\n/g, "<br>");
    this.output.appendChild(line);
    this.output.scrollTop = this.output.scrollHeight;
  },

  printCommand(command) {
    this.print(`guest@nexoraos:${this.cwd}$ ${command}`, "command");
  },

  getFolderId() {
    if (this.cwd === "~/Documents") return "documents";
    if (this.cwd === "~/Downloads") return "downloads";
    return "desktop";
  },

  listFiles() {
    const folder = this.getFolderId();
    const items = fileSystemApi.items.filter((item) => item.parent === folder);

    if (!items.length) {
      return "empty";
    }

    return items.map((item) => item.type === "folder" ? `${item.name}/` : item.name).join("  ");
  },

  catFile(name) {
    const folder = this.getFolderId();
    const item = fileSystemApi.items.find((file) => file.parent === folder && file.name.toLowerCase() === name.toLowerCase());

    if (!item) return `cat: ${name}: No such file`;
    if (item.type === "folder") return `cat: ${name}: Is a directory`;
    return item.content || "";
  },

  run(command) {
    const [base = "", ...args] = command.trim().split(/\s+/);
    const rest = args.join(" ");

    if (!base) {
      return;
    }

    const commands = {
      help: () => "Commands: help, clear, date, whoami, pwd, ls, cd, cat, echo, apps, open, install, uninstall, weather, guide",
      clear: () => {
        this.output.innerHTML = "";
        return "";
      },
      date: () => new Date().toString(),
      whoami: () => "guest",
      pwd: () => `/home/guest/${this.cwd.replace(/^~\/?/, "")}`,
      ls: () => this.listFiles(),
      cd: () => {
        const target = args[0] || "~";
        const map = {
          "~": "~",
          "..": "~",
          desktop: "~",
          Desktop: "~",
          documents: "~/Documents",
          Documents: "~/Documents",
          downloads: "~/Downloads",
          Downloads: "~/Downloads",
        };

        if (!map[target]) {
          return `cd: ${target}: No such directory`;
        }

        this.cwd = map[target];
        this.updatePrompt();
        return "";
      },
      cat: () => rest ? this.catFile(rest) : "cat: missing file name",
      echo: () => rest,
      apps: () => Object.keys(appApi.apps).join("  "),
      open: () => {
        if (!appApi.apps[args[0]]) return `open: ${args[0] || ""}: app not found`;
        appApi.open(args[0]);
        return `Opened ${args[0]}`;
      },
      install: () => {
        if (!installApi.apps[args[0]]) return `install: ${args[0] || ""}: not in VibeStore`;
        installApi.install(args[0]);
        return `Installing ${args[0]}...`;
      },
      uninstall: () => {
        if (!installApi.canUninstall(args[0])) return `uninstall: ${args[0] || ""}: not uninstallable`;
        installApi.uninstall(args[0]);
        return `Uninstalled ${args[0]}`;
      },
      weather: () => document.getElementById("weatherSummary")?.textContent || "Weather app has not loaded yet",
      guide: () => {
        appApi.open("guide");
        return "Opened Guide";
      },
    };

    return commands[base] ? commands[base]() : `${base}: command not found`;
  },

  updatePrompt() {
    if (this.prompt) {
      this.prompt.textContent = `guest@nexoraos:${this.cwd}$`;
    }
  },

  bind() {
    this.print("nexoraos Terminal");
    this.print("Type 'help' for commands.");
    this.updatePrompt();

    const submitCommand = () => {
      const command = this.input.value;
      this.input.value = "";
      this.printCommand(command);
      this.history.push(command);
      this.historyIndex = this.history.length;
      const output = this.run(command);

      if (output) {
        this.print(output);
      }
    };

    this.form?.addEventListener("submit", (event) => {
      event.preventDefault();
      submitCommand();
    });

    this.input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submitCommand();
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        this.historyIndex = Math.max(0, this.historyIndex - 1);
        this.input.value = this.history[this.historyIndex] || "";
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        this.historyIndex = Math.min(this.history.length, this.historyIndex + 1);
        this.input.value = this.history[this.historyIndex] || "";
      }
    });
  },
};
// end terminal api

// guide api
const guideApi = {
  bind() {
    document.querySelectorAll("[data-guide-section]").forEach((button) => {
      button.addEventListener("click", () => {
        const section = button.dataset.guideSection;

        document.querySelectorAll("[data-guide-section]").forEach((item) => {
          item.classList.toggle("active", item === button);
        });

        document.querySelectorAll("[data-guide-pane]").forEach((pane) => {
          pane.classList.toggle("active", pane.dataset.guidePane === section);
        });
      });
    });
  },
};
// end guide api

//  UPD 10JUN system api
const systemApi = {
  dock: document.querySelector(".system-dock"),
  panel: document.getElementById("systemPanel"),
  title: document.getElementById("systemPanelTitle"),
  hint: document.getElementById("systemPanelHint"),
  wifiState: document.getElementById("wifiState"),
  batteryState: document.getElementById("batteryState"),
  brightnessSlider: document.getElementById("brightnessSlider"),
  wifiSpeed: document.getElementById("wifiSpeed"),
  wifiType: document.getElementById("wifiType"),
  wifiGraph: document.getElementById("wifiGraph"),
  batteryLevel: document.getElementById("batteryLevel"),
  batteryDetail: document.getElementById("batteryDetail"),
  wifiOn: true,
  batterySaver: false,
  battery: null,
  probeBusy: false,
  speedHistory: [0.3, 0.44, 0.52, 0.48, 0.66, 0.58, 0.74, 0.69],

  //--->open_system_panel()
  open() {
    if (!this.panel) {
      return;
    }

    this.panel.dataset.mode = "control";
    this.title.textContent = "Control Center";
    this.hint.textContent = "Quick system controls";
    this.panel.classList.add("open");
    this.panel.setAttribute("aria-hidden", "false");
    this.playMorph();

    document.querySelectorAll("[data-status-icon]").forEach((button) => {
      button.classList.remove("active");
    });

    document.querySelector('[data-status-icon="control"]')?.classList.add("active");
  },

  //--->close_system_panel()
  close() {
    if (!this.panel) {
      return;
    }

    this.panel.classList.remove("open");
    this.panel.setAttribute("aria-hidden", "true");
    this.panel.dataset.mode = "control";
    document.querySelectorAll("[data-status-icon]").forEach((button) => {
      button.classList.remove("active");
    });
  },

  //--->play_control_center_morph()
  playMorph() {
    this.panel.classList.remove("morphing");
    this.panel.offsetHeight;
    this.panel.classList.add("morphing");
    window.setTimeout(() => this.panel.classList.remove("morphing"), 220);
  },

  //--->show_control_center()
  showControlCenter() {
    this.open();
  },

  //--->show_system_view()
  showView(mode) {
    if (mode === "wifi") {
      this.toggleWifi();
    }

    if (mode === "battery") {
      this.toggleBatterySaver();
    }
  },

  //--->toggle_wifi()
  toggleWifi() {
    this.wifiOn = !this.wifiOn;
    this.updateStatus();
    this.sampleNetwork();
    this.open();
  },

  //--->toggle_battery_saver()
  toggleBatterySaver() {
    this.batterySaver = !this.batterySaver;
    document.body.classList.toggle("battery-saver", this.batterySaver);
    this.updateStatus();
    this.open();
  },

  //--->set_brightness()
  setBrightness(value) {
    document.documentElement.style.setProperty("--desktop-brightness", `${Number(value) / 100}`);
  },

  //--->get_network_info()
  getNetworkInfo() {
    return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  },

  //--->measure_network_probe()
  async measureNetworkProbe() {
    if (this.probeBusy || !navigator.onLine) {
      return null;
    }

    this.probeBusy = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 2400);
    const started = performance.now();

    try {
      await fetch(`https://www.gstatic.com/generate_204?nexoraos=${Date.now()}`, {
        cache: "no-store",
        mode: "no-cors",
        signal: controller.signal,
      });

      return Math.max(1, Math.round(performance.now() - started));
    } catch (error) {
      return null;
    } finally {
      window.clearTimeout(timeout);
      this.probeBusy = false;
    }
  },

  //--->sample_network()
  async sampleNetwork() {
    const connection = this.getNetworkInfo();
    const online = this.wifiOn && navigator.onLine;
    const downlink = online && connection?.downlink ? Number(connection.downlink) : 0;
    const browserLatency = Number(connection?.rtt || 0);
    const latency = online ? browserLatency || await this.measureNetworkProbe() : null;
    const graphValue = downlink || (latency ? Math.max(0.08, Math.min(4, 180 / latency)) : 0);
    const latencyText = latency ? `${Math.round(latency)}ms live ping` : "live ping unavailable";
    const type = connection?.effectiveType ? connection.effectiveType.toUpperCase() : online ? "Online" : "Offline";
    const source = downlink ? "browser downlink estimate" : "latency probe";

    this.speedHistory.push(graphValue);
    this.speedHistory = this.speedHistory.slice(-16);

    if (this.wifiSpeed) {
      this.wifiSpeed.textContent = online ? downlink ? `${downlink.toFixed(1)} Mbps` : `${latency || "--"} ms` : "Offline";
    }

    if (this.wifiType) {
      this.wifiType.textContent = online ? `${type} - ${latencyText} - ${source}` : "Offline - no connection";
    }

    this.drawWifiGraph();
    this.updateStatus();
  },

  //--->draw_wifi_graph()
  drawWifiGraph() {
    const canvas = this.wifiGraph;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const max = Math.max(2, ...this.speedHistory);
    const step = width / Math.max(1, this.speedHistory.length - 1);

    context.clearRect(0, 0, width, height);
    context.beginPath();

    this.speedHistory.forEach((speed, index) => {
      const x = index * step;
      const y = height - 14 - (speed / max) * (height - 28);

      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });

    context.lineTo(width, height);
    context.lineTo(0, height);
    context.closePath();
    context.fillStyle = "rgba(255, 255, 255, 0.16)";
    context.fill();

    context.beginPath();
    this.speedHistory.forEach((speed, index) => {
      const x = index * step;
      const y = height - 14 - (speed / max) * (height - 28);

      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });

    context.strokeStyle = "rgba(255, 252, 246, 0.72)";
    context.lineWidth = 2;
    context.stroke();
  },

  //--->init_battery()
  initBattery() {
    if (!navigator.getBattery) {
      this.updateBatteryReadout();
      return;
    }

    navigator.getBattery().then((battery) => {
      this.battery = battery;
      battery.addEventListener("levelchange", () => this.updateBatteryReadout());
      battery.addEventListener("chargingchange", () => this.updateBatteryReadout());
      this.updateBatteryReadout();
    });
  },

  //--->get_battery_hint()
  getBatteryHint() {
    if (!this.battery) {
      return this.batterySaver ? "Battery saver on" : "Battery status unavailable";
    }

    const level = Math.round(this.battery.level * 100);
    const state = this.battery.charging ? "charging" : "on battery";

    return `${level}% ${state}`;
  },

  //--->get_battery_icon()
  getBatteryIcon() {
    if (!this.battery) {
      return "battery";
    }

    if (this.battery.charging) {
      return "battery-full";
    }

    if (this.battery.level <= 0.2) {
      return "battery-low";
    }

    if (this.battery.level <= 0.65) {
      return "battery-medium";
    }

    return "battery-full";
  },

  //--->update_battery_readout()
  updateBatteryReadout() {
    if (!this.battery) {
      this.batteryLevel.textContent = "Battery unavailable";
      this.batteryDetail.textContent = "Browser did not expose PC battery status";
      this.batteryState.textContent = "Unknown";
      this.updateStatus();
      return;
    }

    const level = Math.round(this.battery.level * 100);
    const state = this.battery.charging ? "Charging" : "Not charging";

    this.batteryLevel.textContent = `${level}% battery`;
    this.batteryState.textContent = `${level}%`;
    this.batteryDetail.textContent = `${state} - ${this.batterySaver ? "Saver on" : "Saver off"}`;
    this.updateStatus();
  },

  //--->set_status_icon()
  setStatusIcon(button, iconName) {
    if (!button || button.dataset.iconName === iconName) {
      return;
    }

    button.dataset.iconName = iconName;
    button.innerHTML = `<i data-lucide="${iconName}" aria-hidden="true"></i>`;
    this.renderIcons();
  },

  //--->update_system_status()
  updateStatus() {
    const wifiButton = document.querySelector('[data-status-icon="wifi"]');
    const brightnessButton = document.querySelector('[data-status-icon="brightness"]');
    const wifiToggle = document.querySelector('[data-system-view="wifi"]');
    const batteryToggle = document.querySelector('[data-system-view="battery"]');
    const online = this.wifiOn && navigator.onLine;

    this.wifiState.textContent = online ? "Connected" : "Off";
    if (!this.battery) {
      this.batteryState.textContent = "Unknown";
    }

    wifiButton?.classList.toggle("offline", !online);
    wifiButton?.setAttribute("aria-label", online ? "Wi-Fi connected" : "Wi-Fi off");
    brightnessButton?.setAttribute("aria-label", `Brightness ${this.brightnessSlider?.value || 100}%`);
    wifiToggle?.classList.toggle("active", online);
    batteryToggle?.classList.toggle("active", this.batterySaver);

    this.setStatusIcon(wifiButton, online ? "wifi" : "wifi-off");
  },

  //--->render_lucide_icons()
  renderIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  //--->bind_system_controls()
  bind() {
    this.renderIcons();
    this.updateStatus();
    this.sampleNetwork();
    this.initBattery();

    this.dock?.addEventListener("click", (event) => {
      event.stopPropagation();
      this.showControlCenter();
    });

    document.querySelectorAll("[data-system-view]").forEach((button) => {
      button.addEventListener("click", () => {
        this.showView(button.dataset.systemView);
      });
    });

    document.querySelector("[data-system-back]")?.addEventListener("click", () => this.showControlCenter());

    this.brightnessSlider?.addEventListener("input", () => {
      this.setBrightness(this.brightnessSlider.value);
      this.updateStatus();
    });

    window.addEventListener("online", () => {
      this.wifiOn = true;
      this.sampleNetwork();
    });

    window.addEventListener("offline", () => {
      this.sampleNetwork();
    });

    this.panel?.addEventListener("click", (event) => event.stopPropagation());
    document.addEventListener("click", () => this.close());
    setInterval(() => this.sampleNetwork(), 3500);
  },
};

//--->update_clock()
function updateClock() {
  const clock = document.getElementById("clock");
  const lockClock = document.getElementById("lockClock");
  const lockDate = document.getElementById("lockDate");
  const now = new Date();
  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (clock) {
    clock.textContent = time;
  }

  if (lockClock) {
    lockClock.textContent = time;
  }

  if (lockDate) {
    lockDate.textContent = now.toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }
}
// end system api

const lockScreenApi = {
  screen: document.getElementById("lockScreen"),
  button: document.getElementById("unlockButton"),
  unlocked: false,

  unlock() {
    if (!this.screen || this.unlocked) {
      return;
    }

    this.unlocked = true;
    document.body.classList.remove("is-locked");
    document.body.classList.add("lock-dismissed");
    this.screen.setAttribute("aria-hidden", "true");
    firstRunApi.maybeWelcome();
    window.setTimeout(() => {
      this.screen.hidden = true;
    }, 620);
  },

  bind() {
    if (!this.screen) {
      return;
    }

    document.body.classList.add("is-locked");
    this.button?.addEventListener("click", () => this.unlock());
    this.screen.addEventListener("dblclick", () => this.unlock());
    document.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        this.unlock();
      }
    });
  },
};

const bootApi = {
  screen: document.getElementById("bootScreen"),

  start() {
    document.body.classList.add("is-booting");

    window.setTimeout(() => {
      document.body.classList.remove("is-booting");
      document.body.classList.add("boot-complete");
      this.screen?.setAttribute("aria-hidden", "true");
      window.setTimeout(() => {
        if (this.screen) {
          this.screen.hidden = true;
        }
      }, 520);
    }, 2300);
  },
};

const notificationApi = {
  layer: null,

  getLayer() {
    if (!this.layer) {
      this.layer = document.createElement("section");
      this.layer.className = "notification-layer";
      this.layer.setAttribute("aria-live", "polite");
      document.body.appendChild(this.layer);
    }

    return this.layer;
  },

  show({ title = "nexoraos", message, actionLabel = "", onAction = null }) {
    const toast = document.createElement("article");
    toast.className = "vibe-notification";
    toast.innerHTML = `
      <span class="notification-mark" aria-hidden="true">i</span>
      <div>
        <strong>${title}</strong>
        <p>${message}</p>
      </div>
      ${actionLabel ? `<button type="button">${actionLabel}</button>` : ""}
    `;

    const button = toast.querySelector("button");
    button?.addEventListener("click", () => {
      onAction?.();
      toast.remove();
    });

    this.getLayer().appendChild(toast);
    window.setTimeout(() => toast.classList.add("show"), 20);
    window.setTimeout(() => {
      toast.classList.remove("show");
      toast.addEventListener("transitionend", () => toast.remove(), { once: true });
    }, 9000);
  },
};

const firstRunApi = {
  key: "nexoraos-returning-user",

  maybeWelcome() {
    if (localStorage.getItem(this.key)) {
      return;
    }

    localStorage.setItem(this.key, "true");
    window.setTimeout(() => {
      notificationApi.show({
        title: "Welcome",
        message: "Hey new guy, welcome to nexoraos. You should check the guide to use nexoraos to its max!",
        actionLabel: "Open Guide",
        onAction: () => appApi.open("guide"),
      });
    }, 720);
  },
};

//init here :)
settingsApi.load();
settingsApi.apply();
appApi.createApp({ name: "notes", title: "notes", icon: "assets/notes.png", system: true });
appApi.createApp({ name: "browser", title: "Browser", icon: "assets/Browser.png", system: true });
appApi.createApp({ name: "files", title: "files", icon: "assets/file-explorer.png", system: true });
appApi.createApp({ name: "settings", title: "settings", icon: "assets/settings.png", system: true });
appApi.createApp({ name: "vibestore", title: "VibeStore", icon: "assets/vibestore.png", system: true });
appApi.createApp({ name: "terminal", title: "Terminal", iconName: "terminal", system: true });
appApi.createApp({ name: "guide", title: "Guide", iconName: "book-open-check", system: true });
appApi.createApp({ name: "calculator", title: "Calculator", icon: "assets/calculator.png" });
appApi.createApp({ name: "focus", title: "Focus", icon: "assets/focus.png" });
appApi.createApp({ name: "weather", title: "Weather", icon: "assets/weather.png" });
desktopIconApi.load();
installApi.load();
installApi.sync();
desktopIconApi.apply();

notesApi.load();
notesApi.bind();
BrowserApi.bind();
installApi.bind();
calculatorApi.bind();
settingsApi.bind();
focusApi.bind();
terminalApi.bind();
guideApi.bind();
fileSystemApi.load();
fileSystemApi.bind();
fileSystemApi.render();
contextMenuApi.bind();
widgetApi.bindMenu();
desktopIconApi.bind();
systemApi.bind();
dock.renderPinned();
lockScreenApi.bind();
bootApi.start();

document.addEventListener("mousemove", (event) => appApi.moveDrag(event));
document.addEventListener("mousemove", (event) => appApi.moveResize(event));
document.addEventListener("mousemove", (event) => widgetApi.moveDrag(event));
document.addEventListener("pointermove", (event) => desktopIconApi.move(event));
document.addEventListener("pointermove", (event) => fileSystemApi.moveDesktopDrag(event));
document.addEventListener("click", (event) => widgetApi.place(event), true);
document.addEventListener("click", (event) => {
  if (!event.target.closest(".widget-menu")) {
    widgetApi.closeMenu();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    widgetApi.stopPlacement();
    contextMenuApi.closeCustomize();
    contextMenuApi.closeAppMenu();
    fileSystemApi.closeFileMenu();
  }
});
document.addEventListener("mouseup", () => appApi.stopDrag());
document.addEventListener("mouseup", () => appApi.stopResize());
document.addEventListener("mouseup", () => widgetApi.stopDrag());
document.addEventListener("pointerup", () => desktopIconApi.stop());
document.addEventListener("pointerup", () => fileSystemApi.stopDesktopDrag());

updateClock();
setInterval(updateClock, 1000);
widgetApi.updateClockWidgets();
setInterval(() => widgetApi.updateClockWidgets(), 1000);
