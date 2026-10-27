// == STUDENT SCHEDULE CARD + EDITOR ==
(function (LitElement) {
    const html = LitElement.prototype.html;
    const css = LitElement.prototype.css;

    // Attributes of `schedule_entity` that override the card config.
    const ENTITY_KEYS = ["days", "times", "breaks", "subjects", "colors", "break_label", "description"];
    // Index matches Date.getDay().
    const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    // Day labels that are recognised without an explicit `day:` (lower case).
    const DAY_NAMES = {
        sunday: 0, sun: 0, sonntag: 0, so: 0, "ראשון": 0,
        monday: 1, mon: 1, montag: 1, mo: 1, "שני": 1,
        tuesday: 2, tue: 2, dienstag: 2, di: 2, "שלישי": 2,
        wednesday: 3, wed: 3, mittwoch: 3, mi: 3, "רביעי": 3,
        thursday: 4, thu: 4, donnerstag: 4, do: 4, "חמישי": 4,
        friday: 5, fri: 5, freitag: 5, fr: 5, "שישי": 5,
        saturday: 6, sat: 6, samstag: 6, sa: 6, "שבת": 6,
    };

    // Fields of the editor's General tab, rendered with <ha-form>.
    const GENERAL_SCHEMA = [
        { name: "person_entity", selector: { entity: { domain: "person" } } },
        { name: "schedule_entity", selector: { entity: {} } },
        { name: "name", selector: { text: {} } },
        { name: "icon", selector: { icon: {} } },
        { name: "description", selector: { text: {} } },
        { name: "default_placeholder", selector: { text: {} } },
        { name: "show_breaks", selector: { boolean: {} } },
        { name: "break_label", selector: { text: {} } },
        {
            name: "first_day_of_week",
            selector: { select: { mode: "dropdown", options: [
                { value: "monday", label: "Monday" },
                { value: "sunday", label: "Sunday" },
            ] } },
        },
        { name: "show_highlight", selector: { boolean: {} } },
        { name: "show_rooms", selector: { boolean: {} } },
        { name: "shorten_room_names", selector: { boolean: {} } },
        { name: "mobile_view", selector: { boolean: {} } },
        { name: "rtl", selector: { boolean: {} } },
    ];
    const GENERAL_LABELS = {
        person_entity: "Child (person entity)",
        schedule_entity: "Schedule entity (optional, its attributes override days, times, breaks, subjects and colors)",
        name: "Name (if no person entity)",
        icon: "Icon (if no person entity)",
        description: "Description",
        default_placeholder: "Default placeholder",
        show_breaks: "Show breaks",
        break_label: "Break label",
        first_day_of_week: "First day of week (for days without a recognised weekday)",
        show_highlight: "Highlight current time",
        show_rooms: "Show rooms",
        shorten_room_names: "Shorten room names",
        mobile_view: "Single-day view on narrow screens",
        rtl: "Right-to-left",
    };
    const WEEKDAY_SELECTOR = {
        select: {
            mode: "dropdown",
            options: [
                { value: "auto", label: "Weekday: auto-detect" },
                ...WEEKDAYS.map((w) => ({ value: w, label: w[0].toUpperCase() + w.slice(1) })),
            ],
        },
    };

    // A `days` entry is either a label string or { label, day, enabled }.
    function normalizeDay(entry, index) {
        if (entry && typeof entry === "object") {
            return { label: entry.label || "", day: entry.day || null, enabled: entry.enabled !== false, index };
        }
        return { label: String(entry ?? ""), day: null, enabled: true, index };
    }

    function weekdayOf(day) {
        if (day.day && WEEKDAYS.includes(day.day)) return WEEKDAYS.indexOf(day.day);
        return DAY_NAMES[day.label.toLowerCase()] ?? -1;
    }

    // MARK: Card Component
    class StudentScheduleCard extends LitElement {
        static get properties() {
            return {
                hass: {},
                config: {},
                _mobileDayIndex: { state: true },
            };
        }

        setConfig(config) {
            if (!config.schedule_entity && (!config.times || !config.subjects || !config.days)) {
                throw new Error("You must define 'days', 'times', and 'subjects', or 'schedule_entity'.");
            }
            this.config = {
                show_highlight: true,
                show_rooms: true,
                shorten_room_names: true,
                ...structuredClone(config),
            };
        }

        // Card config with the attributes of `schedule_entity` (if set) applied on top.
        _effectiveConfig() {
            const entity = this.config.schedule_entity && this.hass?.states[this.config.schedule_entity];
            if (!entity) return this.config;
            const merged = { ...this.config };
            for (const key of ENTITY_KEYS) {
                if (entity.attributes[key] != null) merged[key] = entity.attributes[key];
            }
            return merged;
        }

        getCardSize() {
            return (this._effectiveConfig().times?.length || 0) + 1;
        }

        render() {
            const config = this._effectiveConfig();
            if (!config.times || !config.subjects || !config.days) {
                return html`<ha-card><div class="warning">
                    ${config.schedule_entity}: entity not found or missing 'days', 'times' or 'subjects' attributes
                </div></ha-card>`;
            }
            const times = config.times;
            const subjects = config.subjects;
            const breaks = config.show_breaks ? config.breaks || [] : [];
            const breakLabel = config.break_label || "Pause";
            const containerWidth = this.offsetWidth;
            const useShortDays = containerWidth < 700; // adjust threshold
            const useShortSubjects = containerWidth < 700; // adjust threshold
            const defaultPlaceholder = config.default_placeholder;
            const showHighlight = config.show_highlight !== false;
            const showRooms = config.show_rooms !== false;
            const shortenRooms = useShortSubjects && config.shorten_room_names !== false;
            const visibleDays = config.days.map(normalizeDay).filter((d) => d.enabled);
            const labels = visibleDays.map((d) => d.label);
            const days = useShortDays ? this._shortenDays(labels) : labels;
            const useShortTime = days.length > 5 && containerWidth < 700; // adjust threshold
            const displayBreak = useShortDays
                ? this._shortenSubject(breakLabel)
                : breakLabel;
            const allTimes = [
                ...times.map((t) => ({ type: "lesson", time: t })),
                ...breaks.map((b) => ({ type: "break", time: b })),
            ].sort(
                (a, b) =>
                    this._toMinutes(a.time.split("-")[0]) -
                    this._toMinutes(b.time.split("-")[0])
            );

            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const todayIndex = this._todayIndex(visibleDays, config.first_day_of_week);

            if (config.mobile_view === true && containerWidth > 0 && containerWidth < 480) {
                return this._renderMobileView(config, visibleDays, allTimes, currentMinutes, todayIndex);
            }

            return html`
        <ha-card
          header=${this._renderHeader(config)}
          style="padding-bottom: 24px; width: 100%;"
          dir=${config.rtl === true ? "rtl" : "ltr"}
        >
          <table class="stundenplan">
            <tr>
              <th></th>
             ${days.map((day, dayIdx) => {
                const highlightClass = showHighlight && dayIdx === todayIndex ? "highlight" : "";
                return html`<th id="tag-${day}" class="${highlightClass}">${day}</th>`;
            })}
            </tr>
            ${allTimes.map((row) => {
                const [start, end] = row.time.split("-").map((t) => t.trim());
                const startMin = this._toMinutes(start);
                const endMin = this._toMinutes(end);
                const isNow =
                    todayIndex !== -1 && currentMinutes >= startMin && currentMinutes < endMin;
                const rowClass =
                    row.type === "break"
                        ? "pause"
                        : showHighlight && isNow
                            ? "active-row"
                            : "";


                return html`
                <tr class="${rowClass}">
                  <td>
                    <b
                      >${useShortTime
                        ? row.time.split("-")[0].trim()
                        : row.time}</b
                    >
                  </td>
                  ${days.map((_, dayIdx) => {
                            const tagClass =
                                showHighlight && dayIdx === todayIndex
                                    ? "highlight-col-cell"
                                    : "";
                            if (row.type === "break")
                                return html`<td class="pause ${tagClass}">
                        ${displayBreak}
                      </td>`;

                            const { subject, room, isFree } = this._lesson(
                                subjects, visibleDays[dayIdx], times, row.time, defaultPlaceholder
                            );
                            const baseColor = config.colors?.[isFree ? "FREE" : subject] || "#ccc";

                            const displayName = useShortSubjects
                                ? this._shortenSubject(subject)
                                : subject;
                            const tooltip = room
                                ? `${subject} – Room ${room}`
                                : subject;

                            return html`
                      <td
                        class="${tagClass}"
                        style="background-color:${this._withAlpha(
                                baseColor
                            )}; text-align:center"
                      >
                        <div title="${tooltip}">
                          <div>${displayName}</div>
                          ${room && showRooms
                                    ? html`<div class="room">${shortenRooms ? this._shortenSubject(room) : room}</div>`
                                    : ""}
                        </div>
                      </td>
                    `;
                        })}
                </tr>
              `;
            })}
          </table>
        </ha-card>
      `;
        }

        _renderMobileView(config, visibleDays, allTimes, currentMinutes, todayIndex) {
            const showHighlight = config.show_highlight !== false;
            const showRooms = config.show_rooms !== false;
            const rtl = config.rtl === true;
            let dayIdx = this._mobileDayIndex ?? todayIndex;
            if (dayIdx < 0 || dayIdx >= visibleDays.length) dayIdx = 0;
            const isToday = dayIdx === todayIndex;
            const step = (delta) => {
                this._mobileDayIndex = (dayIdx + delta + visibleDays.length) % visibleDays.length;
            };

            return html`
        <ha-card
          header=${this._renderHeader(config)}
          style="padding-bottom: 24px; width: 100%;"
          dir=${rtl ? "rtl" : "ltr"}
        >
          <div class="mobile-nav">
            <ha-icon-button @click=${() => step(-1)} label="Previous day">
              <ha-icon icon=${rtl ? "mdi:chevron-right" : "mdi:chevron-left"}></ha-icon>
            </ha-icon-button>
            <span class="mobile-day-title ${showHighlight && isToday ? "highlight" : ""}">
              ${visibleDays[dayIdx]?.label}
            </span>
            <ha-icon-button @click=${() => step(1)} label="Next day">
              <ha-icon icon=${rtl ? "mdi:chevron-left" : "mdi:chevron-right"}></ha-icon>
            </ha-icon-button>
          </div>
          <div class="mobile-schedule">
            ${allTimes.map((row) => {
                if (row.type === "break") {
                    return html`<div class="mobile-row pause">
                        <div class="mobile-time">${row.time}</div>
                        <div>${config.break_label || "Pause"}</div>
                    </div>`;
                }
                const [start, end] = row.time.split("-").map((t) => this._toMinutes(t.trim()));
                const isNow = isToday && currentMinutes >= start && currentMinutes < end;
                const { subject, room, isFree } = this._lesson(
                    config.subjects, visibleDays[dayIdx], config.times, row.time, config.default_placeholder
                );
                const baseColor = config.colors?.[isFree ? "FREE" : subject] || "#ccc";
                return html`
                <div
                  class="mobile-row ${showHighlight && isNow ? "active-row" : ""}"
                  style="background-color:${this._withAlpha(baseColor)}"
                >
                  <div class="mobile-time">${row.time}</div>
                  <div class="mobile-content">
                    <div>${subject}</div>
                    ${room && showRooms ? html`<div class="room">${room}</div>` : ""}
                  </div>
                </div>`;
            })}
          </div>
        </ha-card>
      `;
        }

        // Resolves the lesson of a day at a time slot. Subjects are keyed by the day's
        // position in `days` (1-based), so hiding a day does not shift the others.
        _lesson(subjects, day, times, time, placeholder) {
            const index = times.findIndex((t) => t.trim() === time);
            const raw = subjects?.[(day.index + 1).toString()]?.[index];
            if (typeof raw === "object" && raw !== null) {
                const isFree = raw.free === true;
                return {
                    subject: isFree ? placeholder : raw.subject || placeholder,
                    room: isFree ? null : raw.room || null,
                    isFree,
                };
            }
            return { subject: typeof raw === "string" ? raw : placeholder, room: null, isFree: false };
        }

        // Position of today in `days`, or -1. Days without a recognisable weekday
        // fall back to their position, counted from `first_day_of_week`.
        _todayIndex(days, firstDayOfWeek) {
            const today = new Date().getDay();
            const offset = firstDayOfWeek === "sunday" ? 0 : 1;
            return days.findIndex((d) => {
                const weekday = weekdayOf(d);
                return (weekday !== -1 ? weekday : (offset + d.index) % 7) === today;
            });
        }

        _shortenDays(days) {
            return days.map((d) =>
                d.length > 3
                    ? d.slice(0, 2) // e.g. "Monday" -> "Mo"
                    : d
            );
        }
        _shortenSubject(name) {
            if (!name || name.length <= 2) return name;
            return name.slice(0, 2); // e.g. "Mathematics" -> "Ma"
        }
        connectedCallback() {
            super.connectedCallback();
            this._resizeObserver = new ResizeObserver(() => this.requestUpdate());
            this._resizeObserver.observe(this);
        }

        disconnectedCallback() {
            this._resizeObserver.disconnect();
            super.disconnectedCallback();
        }

        _toMinutes(t) {
            const [h, m] = t.split(":").map(Number);
            return h * 60 + m;
        }
        _renderHeader(config) {
            const { person_entity, name, icon, description } = config;

            if (person_entity && this.hass?.states[person_entity]) {
                const entity = this.hass.states[person_entity];
                const entityName = entity.attributes.friendly_name || person_entity;
                const entityIcon = entity.attributes.icon || "mdi:account";
                const avatar = entity.attributes.entity_picture;

                return html`
          <div style="text-align: center;">
            <span
              style="display: flex; align-items: center; justify-content: center; gap: 8px;"
            >
              ${avatar
                        ? html`<img
                    src="${avatar}"
                    style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;"
                    alt="avatar"
                  />`
                        : html`<ha-icon icon="${entityIcon}"></ha-icon>`}
              <span>${entityName}</span>
            </span>
            ${description
                        ? html`<div
                  style="margin-top: 4px; font-size: 0.85em; color: var(--secondary-text-color);"
                >
                  ${description}
                </div>`
                        : ""}
          </div>
        `;
            }

            return html`
        <div style="text-align: center;">
          <span
            style="display: flex; align-items: center; justify-content: center; gap: 8px;"
          >
            ${icon ? html`<ha-icon icon="${icon}"></ha-icon>` : ""}
            <span>${name || "Student Schedule"}</span>
          </span>
          ${description
                    ? html`<div
                style="margin-top: 4px; font-size: 0.85em; color: var(--secondary-text-color);"
              >
                ${description}
              </div>`
                    : ""}
        </div>
      `;
        }
        _withAlpha(hex, alpha = 0.85) {
            if (hex.startsWith("#")) {
                if (hex.length === 4)
                    hex = "#" + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
                const bigint = parseInt(hex.slice(1), 16);
                const r = (bigint >> 16) & 255;
                const g = (bigint >> 8) & 255;
                const b = bigint & 255;
                return `rgba(${r},${g},${b},${alpha})`;
            }
            return hex;
        }

        static get styles() {
            return css`
        :host {
          display: block;
          width: 100%;
        }
        .stundenplan {
          border-collapse: collapse;
          width: 100%;
          font-family: sans-serif;
        }
        .stundenplan th,
        .stundenplan td {
          border: 1px solid var(--divider-color, #ccc);
          padding: 8px;
        }

        .stundenplan td:first-child {
          font-weight: bold;
          background: rgba(0, 0, 0, 0.05);
          white-space: nowrap;
        }
        .room {
          font-size: 0.75em;
          color: var(--secondary-text-color, #666);
          margin-top: 2px;
        }
        .highlight {
          background: var(--primary-color);
          color: white;
        }
        .highlight-col-cell {
          border-left: 2px solid var(--primary-color);
          border-right: 2px solid var(--primary-color);
        }
        .pause td,
        .pause {
          background: rgba(200, 200, 200, 0.3) !important;
          font-style: italic;
          text-align: center;
        }
        .active-row td {
          border-bottom: 3px solid var(--primary-color);
          font-weight: bold;
        }
        .warning {
          padding: 16px;
          color: var(--error-color);
        }
        .mobile-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 8px;
          border-bottom: 1px solid var(--divider-color, #ccc);
        }
        .mobile-day-title {
          font-size: 1.2em;
          font-weight: bold;
          padding: 4px 16px;
          border-radius: 4px;
        }
        .mobile-schedule {
          padding: 8px;
        }
        .mobile-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          margin: 4px 0;
          border-radius: 8px;
          border: 1px solid var(--divider-color, #ccc);
        }
        .mobile-row.active-row {
          border: 2px solid var(--primary-color);
          font-weight: bold;
        }
        .mobile-time {
          font-weight: bold;
          min-width: 100px;
          font-size: 0.9em;
          color: var(--secondary-text-color);
        }
        .mobile-content {
          flex: 1;
        }
      `;
        }

        static getConfigElement() {
            return document.createElement("student-schedule-card-editor");
        }

        static getStubConfig() {
            return {
                name: "Student Schedule",
                description: "Week A",
                default_placeholder: "--",
                show_highlight: true,
                show_rooms: true,
                shorten_room_names: true,
                show_breaks: true,
                break_label: "Break",
                days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                times: ["8:00 - 8:45", "8:45 - 9:30"],
                breaks: ["9:30 - 9:50"],
                subjects: {
                    1: [
                        { subject: "Math", room: "101" },
                        { subject: "English", room: "102" }
                    ],
                    2: [
                        { subject: "Science", room: "201" },
                        { subject: "Music", room: "203" }
                    ],
                    3: [
                        { free: true },
                        { free: true }
                    ],
                    4: [
                        { free: true },
                        { free: true }
                    ],
                    5: [
                        { free: true },
                        { free: true }
                    ],
                    6: [
                        { free: true },
                        { free: true }
                    ],
                    7: [
                        { free: true },
                        { free: true }
                    ]
                },
                colors: {
                    Math: "#2196f3",
                    English: "#4caf50",
                    Science: "#f44336",
                    Music: "#9c27b0",
                    FREE: "#cccccc"
                }
            };
        }
    }

    customElements.define("student-schedule-card", StudentScheduleCard);

    //MARK: Editor Component

    class StudentScheduleCardEditor extends LitElement {
        static get properties() {
            return {
                hass: {},
                config: {},
                _tabIndex: { type: Number },
                _data: {},
                _subjects: Array,
                _entity: String,
            };
        }

        constructor() {
            super();
            this._tabIndex = 0;
        }

        setConfig(config) {
            this.config = config || {};
            this._data = structuredClone(config);

            const placeholder = this._data.default_placeholder || "--";
            const updatedSubjects = this._data.subjects || {};

            for (const dayKey in updatedSubjects) {
                updatedSubjects[dayKey] = updatedSubjects[dayKey].map((fach) => {
                    if (typeof fach === "string") {
                        return fach.trim() === "" ? null : fach;
                    } else if (typeof fach === "object" && fach !== null) {
                        const entry = { ...fach };

                        // subject may stay null - do not fill in the placeholder
                        if ("subject" in entry && entry.subject?.trim?.() === "") {
                            entry.subject = null;
                        }

                        if ("room" in entry && entry.room?.trim?.() === "") {
                            entry.room = null;
                        }

                        // Only derive free automatically if it is not set explicitly
                        if (!("free" in entry)) {
                            entry.free = !entry.subject && !entry.room;
                        }

                        return entry;
                    } else {
                        return null;
                    }
                });
            }

            this._data.subjects = updatedSubjects;
            this._subjects = this._extractSubjects(updatedSubjects);
        }

        render() {
            const tabs = ["General", "Times", "Colors", "Subjects"];
            return html`
        <div class="tabs">
          ${tabs.map((t, i) => html`
            <button
              class="tab ${i === this._tabIndex ? "active" : ""}"
              @click=${() => (this._tabIndex = i)}
            >${t}</button>
          `)}
        </div>
        <div class="card-content">
          ${this._data.schedule_entity
                    ? html`<ha-alert alert-type="info">
              Days, times, breaks, subjects and colors provided by ${this._data.schedule_entity}
              override the values set here.
            </ha-alert>`
                    : ""}
          ${this._tabIndex === 0 ? this._renderGeneralTab() : ""}
          ${this._tabIndex === 1 ? this._renderTimesTab() : ""}
          ${this._tabIndex === 2 ? this._renderColorsTab() : ""}
          ${this._tabIndex === 3 ? this._renderSubjectsTab() : ""}
        </div>
      `;
        }

        // Values shown in the form, with the card's defaults filled in.
        _formData() {
            const d = this._data;
            return {
                ...d,
                show_breaks: d.show_breaks === true,
                show_highlight: d.show_highlight !== false,
                show_rooms: d.show_rooms !== false,
                shorten_room_names: d.shorten_room_names !== false,
                mobile_view: d.mobile_view === true,
                rtl: d.rtl === true,
                first_day_of_week: d.first_day_of_week || "monday",
            };
        }

        // Applies only the fields the user changed, so opening the editor does not
        // write the defaults into the config.
        _formChanged(ev) {
            ev.stopPropagation();
            const before = this._formData();
            const after = ev.detail.value;
            for (const { name } of GENERAL_SCHEMA) {
                if (after[name] === before[name]) continue;
                this._updateField(name, after[name] === "" ? undefined : after[name]);
            }
        }

        _renderGeneralTab() {
            return html`
    <ha-form
      .hass=${this.hass}
      .data=${this._formData()}
      .schema=${GENERAL_SCHEMA}
      .computeLabel=${(field) => GENERAL_LABELS[field.name] ?? field.name}
      @value-changed=${this._formChanged}
    ></ha-form>

    <label class="editor-label">Days:</label>
    ${(this._data.days || []).map(normalizeDay).map((day) => html`
      <div class="day-row">
        <ha-selector
          .hass=${this.hass}
          .selector=${{ text: {} }}
          .label=${"Display name"}
          .required=${false}
          .value=${day.label}
          @value-changed=${(e) => {
                    e.stopPropagation();
                    this._updateDay(day.index, "label", e.detail.value ?? "");
                }}
        ></ha-selector>
        <ha-selector
          .hass=${this.hass}
          .selector=${WEEKDAY_SELECTOR}
          .value=${day.day || "auto"}
          @value-changed=${(e) => {
                    e.stopPropagation();
                    this._updateDay(day.index, "day", e.detail.value === "auto" ? null : e.detail.value);
                }}
        ></ha-selector>
        <ha-formfield label="Show">
          <ha-switch
            .checked=${day.enabled}
            @change=${(e) => this._updateDay(day.index, "enabled", e.target.checked)}
          ></ha-switch>
        </ha-formfield>
        <ha-icon-button
          .label=${"Remove day"}
          @click=${() => this._removeDay(day.index)}
        ><ha-icon icon="mdi:delete"></ha-icon></ha-icon-button>
      </div>
    `)}
    <ha-button @click=${this._addDay}>Add day</ha-button>
  `;
        }
        _renderTimesTab() {
            return html`
        <label class="editor-label">Times (one per line):</label>
        <ha-code-editor
          mode="yaml"
          .value=${(this._data.times || []).join("\n")}
          @value-changed=${(e) => this._updateCode("times", e.detail.value)}
        ></ha-code-editor>

        <label class="editor-label">Breaks (one per line):</label>
        <ha-code-editor
          mode="yaml"
          .value=${(this._data.breaks || []).join("\n")}
          @value-changed=${(e) => this._updateCode("breaks", e.detail.value)}
        ></ha-code-editor>
      `;
        }

        _updateField(key, value) {
            if (!this._data) return;

            // Special case: the placeholder changed
            if (key === "default_placeholder") {
                const oldPlaceholder = this._previousPlaceholder;
                const newPlaceholder = value;

                this._data.default_placeholder = newPlaceholder;
                this._replacePlaceholder(oldPlaceholder, newPlaceholder);
                this._previousPlaceholder = newPlaceholder;
            } else if (value === undefined) {
                const { [key]: _removed, ...rest } = this._data;
                this._data = rest;
            } else {
                this._data = { ...this._data, [key]: value };
            }

            this._emit();
        }

        _addDay() {
            const days = this._data.days || [];
            this._updateField("days", [...days, `Day ${days.length + 1}`]);
        }

        // Subjects are keyed by day position, so the days after the removed one move up a key.
        _removeDay(index) {
            const days = this._data.days.filter((_, i) => i !== index);
            const subjects = {};
            for (const [key, lessons] of Object.entries(this._data.subjects || {})) {
                const pos = Number(key) - 1;
                if (pos < index) subjects[key] = lessons;
                else if (pos > index) subjects[String(pos)] = lessons;
            }
            this._data = { ...this._data, subjects };
            this._subjects = this._extractSubjects(subjects);
            this._updateField("days", days);
        }

        _updateDay(index, field, value) {
            const day = normalizeDay(this._data.days[index], index);
            if (day[field] === value) return;
            const { label, day: weekday, enabled } = { ...day, [field]: value };
            const days = [...this._data.days];
            // Keep plain strings for days that only have a label.
            days[index] = weekday || !enabled
                ? { label, ...(weekday && { day: weekday }), ...(!enabled && { enabled: false }) }
                : label;
            this._updateField("days", days);
        }
        _replacePlaceholder(oldValue, newValue) {
            const days = this._data.days || ["Mon", "Tue", "Wed", "Thu", "Fri"];
            const times = this._data.times || [];
            const placeholder = newValue || "--";

            const subjects = structuredClone(this._data.subjects || {});

            for (let dayIndex = 1; dayIndex <= 7; dayIndex++) {
                const key = dayIndex.toString();
                if (!subjects[key]) subjects[key] = [];

                for (let i = 0; i < times.length; i++) {
                    if (!subjects[key][i]) {
                        subjects[key][i] = placeholder;
                    } else if (subjects[key][i] === oldValue) {
                        subjects[key][i] = placeholder;
                    }
                }
            }

            this._data.subjects = subjects;
            this._subjects = this._extractSubjects(subjects);
        }
        _updateCode(key, value) {
            this._data = {
                ...this._data,
                [key]: value
                    .split("\n")
                    .map((v) => v.trim())
                    .filter(Boolean),
            };
            this._emit();
        }

        _renderColorsTab() {
            return html`
    <div class="grid">
      ${["FREE", ...[...this._subjects]
                    .filter(
                        (subject) =>
                            subject &&
                            subject !== this._data.default_placeholder &&
                            subject !== "FREE"
                    )
                ].map((subject) => html`
        <label>${subject}</label>
        <input
          type="color"
          .value=${this._toColor(this._data.colors?.[subject])}
          @input=${(e) => this._updateColor(subject, e.target.value)}
        />
      `)}
    </div>
  `;
        }


        _renderSubjectsTab() {
            const days = this._data.days || ["Mon", "Tue", "Wed", "Thu", "Fri"];
            const times = this._data.times || [];
            const subjects = this._data.subjects || {};
            const placeholder = this._data.default_placeholder || "--";

            const splitAt = 4; // e.g. wrap after Thursday
            const dayChunks = [days.slice(0, splitAt), days.slice(splitAt)];

            return html`
        ${dayChunks.map((dayGroup, groupIndex) => {
                const dayIndices = Object.fromEntries(
                    dayGroup.map((d, i) => [
                        (i + 1 + groupIndex * splitAt).toString(),
                        d,
                    ])
                );

                return html`
            <table class="matrix">
              <tr>
                <th></th>
                ${dayGroup.map((day) => html`<th>${normalizeDay(day).label}</th>`)}
              </tr>
              ${times.map(
                    (time, rowIndex) => html`
                  <tr>
                    <td>${time}</td>
                    ${Object.keys(dayIndices).map((dayIndex) => {
                        const raw = subjects?.[dayIndex]?.[rowIndex];
                        let subject = "";
                        let room = "";
                        let entry = {};

                        if (typeof raw === "object" && raw !== null) {
                            subject = raw.subject || "";
                            room = raw.room || "";
                            entry = raw;
                        } else if (typeof raw === "string") {
                            subject = raw;
                            entry = { subject };
                        }

                        return html`<td>
                        <input
                          type="text"
                          placeholder="Subject"
                          .value=${subject}
                          class="input-subject"
                          @input=${(e) =>
                                this._updateSubjectField(
                                    dayIndex,
                                    rowIndex,
                                    "subject",
                                    e.target.value
                                )}
                        />
                        <input
                          type="text"
                          placeholder="Room"
                          .value=${room}
                          class="input-room"
                          @input=${(e) =>
                                this._updateSubjectField(
                                    dayIndex,
                                    rowIndex,
                                    "room",
                                    e.target.value
                                )}
                        />
                        <label
                          style="font-size: 0.7em; display: flex; align-items: center; gap: 4px;"
                        >
                          <input
                            type="checkbox"
                            .checked=${entry?.free === true}
                            @change=${(e) =>
                                this._updateSubjectField(
                                    dayIndex,
                                    rowIndex,
                                    "free",
                                    e.target.checked
                                )}
                          />
                          Free
                        </label>
                      </td>`;
                    })}
                  </tr>
                `
                )}
            </table>
            <br />
          `;
            })}
      `;
        }

        _updateSubjectField(dayIndex, rowIndex, field, value) {
            const subj = { ...(this._data.subjects || {}) };
            if (!subj[dayIndex]) subj[dayIndex] = [];

            let entry = subj[dayIndex][rowIndex];

            if (typeof entry !== "object" || entry === null) {
                entry = { subject: typeof entry === "string" ? entry : "" };
            }

            if (field === "free") {
                entry.free = value === true;
            } else {
                entry[field] = value;

                // Automatic free detection if subject and room are empty
                // const isSubjectEmpty = !entry.subject || entry.subject.trim() === "";
                // const isRoomEmpty = !entry.room || entry.room.trim() === "";
                // entry.free = isSubjectEmpty && isRoomEmpty;
            }

            if (field === "subject" && value.trim() === "") {
                entry.subject = null;
            }
            // Clean up
            if (!entry.free) delete entry.free;

            // Empty object? Remove it entirely
            if (Object.keys(entry).length === 0) {
                delete subj[dayIndex][rowIndex];
            } else {
                subj[dayIndex][rowIndex] = entry;
            }

            this._data.subjects = subj;
            this._subjects = this._extractSubjects(subj);
            this._emit();
        }

        _extractSubjects(subjects) {
            const s = new Set();
            Object.values(subjects).forEach((row) =>
                row.forEach((fach) => {
                    if (typeof fach === "object" && fach?.free === true) {
                        s.add("FREE");
                    } else if (typeof fach === "object" && fach.subject) {
                        s.add(fach.subject);
                    } else if (typeof fach === "string") {
                        s.add(fach);
                    }
                })
            );
            return s;
        }

        _updateSubject(dayIndex, rowIndex, value) {
            const subj = { ...(this._data.subjects || {}) };
            if (!subj[dayIndex]) subj[dayIndex] = [];
            subj[dayIndex][rowIndex] = value;
            this._data.subjects = subj;
            this._subjects = this._extractSubjects(subj);
            this._emit();
        }

        _toColor(val) {
            if (!val || val.startsWith("rgba")) return "#888888";
            return val;
        }
        _emit() {
            this.dispatchEvent(
                new CustomEvent("config-changed", {
                    detail: { config: this._data },
                    bubbles: true,
                    composed: true,
                })
            );
        }
        _updateColor(fach, color) {
            const newColors = { ...(this._data.colors || {}) };
            newColors[fach] = color;
            this._data.colors = newColors;
            this._emit();
        }

        static get styles() {
            return css`
        .grid {
          display: grid;
          grid-template-columns: auto auto;
          gap: 10px;
          margin: 1em;
        }
        table.matrix {
          width: 100%;
          border-collapse: collapse;
          margin-top: 1em;
        }
        .matrix td,
        .matrix th {
          border: 1px solid var(--divider-color, #444);
          padding: 4px;
        }
        .matrix input {
          width: 100%;
          border: none;
          background: transparent;
          color: inherit;
        }
        .editor-label {
          font-size: 0.85rem;
          font-weight: 500;
          margin-top: 1em;
          display: block;
          color: var(--secondary-text-color);
        }
        .input-subject,
        .input-room {
          width: 100%;
          box-sizing: border-box;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          border: 1px solid var(--divider-color);
          padding: 2px;
          margin-bottom: 2px;
          font-size: 0.8em;
        }
        .input-room {
          opacity: 0.7;
          font-style: italic;
        }
        .tabs {
  display: flex;
  border-bottom: 1px solid var(--divider-color);
  margin-bottom: 8px;
}
.tab {
  flex: 1;
  padding: 12px 8px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--secondary-text-color);
  font: inherit;
  cursor: pointer;
}
.tab.active {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
}
ha-form {
  display: block;
  margin-bottom: 8px;
}
.day-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-top: 8px;
}
.day-row ha-selector {
  flex: 1 1 140px;
}

      `;
        }
    }

    customElements.define(
        "student-schedule-card-editor",
        StudentScheduleCardEditor
    );

    window.customCards = window.customCards || [];
    window.customCards.push({
        type: "student-schedule-card",
        name: "Student Schedule Card",
        description: "A configurable schedule (timetable) card for Home Assistant.",
        preview: true,
        documentationURL: "",
        configElement: "student-schedule-card-editor",
    });
})(
    window.LitElement ||
    Object.getPrototypeOf(customElements.get("hui-masonry-view"))
);

console.info(
    `%c 📘 STUDENT-SCHEDULE-CARD %c v1.1.0 `,
    "background: #3f51b5; color: white; font-weight: bold; padding: 2px 8px; border-radius: 4px;",
    "background: #009688; color: white; font-weight: bold; padding: 2px 6px; border-radius: 4px;"
);
