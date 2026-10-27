# Student Schedule Card

[![](https://img.shields.io/badge/Home%20Assistant-Custom%20Card-blue.svg?style=flat-square)](https://www.home-assistant.io/lovelace/)

A flexible and fully UI-configurable student schedule card for [Home Assistant](https://www.home-assistant.io/) Lovelace UI.

Supports subject management, color coding, room display, current time highlighting, responsive layout, and more.

![Preview 1](https://github.com/DomCim/student-schedule-card/blob/main/images/columnWidth1.png)
![Preview 2](https://github.com/DomCim/student-schedule-card/blob/main/images/ColumnWidth2.png)

---

## ✨ Features

- 📅 Custom days, times, breaks & layout
- 🎨 Color-coded subjects (incl. "free" slots)
- 🧑 Displays avatar & name from `person` entity
- 🏫 Optional room display per subject
- 📱 Responsive layout with shortened labels
- ⏰ Highlights current day and lesson
- 🔧 Full visual configuration (no YAML required)
- 🛠️ Still editable in YAML if preferred
- 📡 Optional `schedule_entity`: load the timetable from a sensor's attributes
- ↔️ Right-to-left (RTL) layout
- 📆 Per-day settings: custom label, explicit weekday, show/hide
- 🗓️ Week can start on Monday or Sunday
- 📱 Optional single-day mobile view with previous/next navigation

---
## 📦 HACS Installation

This card is available as a **custom repository** in [HACS](https://hacs.xyz):

1. In HACS, go to **Frontend > ⋮ > Custom repositories**
2. Add the repository URL:  `https://github.com/DomCim/student-schedule-card/`
3. Set category to **Lovelace**
4. Install `student-schedule-card`
5. Add the resource automatically or manually (see below)

## 🚀 Installation

### Manual Installation

1. Download the latest `student-schedule-card.js` file.
2. Place it into your `config/www/` directory.
3. Add the resource to your Lovelace config:

```yaml
resources:
  - url: /local/student-schedule-card.js?v=1.1.0
    type: module
```

4. Restart Home Assistant or reload Lovelace resources.

---

## 🧪 Example Configuration

```yaml
type: custom:student-schedule-card
name: Jan
description: Week A
person_entity: person.jan
default_placeholder: "--"
show_breaks: true
break_label: Break
show_rooms: true
shorten_room_names: true
show_highlight: true
days:
  - Monday
  - Tuesday
  - Wednesday
  - Thursday
  - Friday
  - Saturday
  - Sunday
times:
  - 8:00 - 8:45
  - 8:45 - 9:30
  - 9:50 - 10:35
  - 10:35 - 11:20
  - 11:30 - 12:15
  - 12:15 - 13:00
  - 13:15 - 14:00
  - 16:30 - 17:30
  - 17:30 - 18:30
breaks:
  - 9:30 - 9:50
  - 11:20 - 11:30
  - 13:00 - 13:15
colors:
  Deutsch: "#4caf50"
  Mathe: "#b13e3e"
  Kunst: "#961599"
  HSU: "#2774b0"
  Religion: "#330505"
  Musik: "#009688"
  Englisch: "#bd42a2"
  WG: "#ffc107"
  Chor: "#476d80"
  Sport: "#ff9800"
  Handball: "#888888"
  Fußball: "#999999"
  FREE: "#ae4242"
subjects:
  "1":
    - subject: Deutsch
    - subject: Mathe
    - subject: Kunst
      free: false
      room: 1.OG 5
    - subject: HSU
    - subject: Deutsch
    - subject: HSU
      free: true
    - free: true
    - free: true
    - free: true
  "2":
    - subject: Deutsch
    - subject: Religion
    - subject: WG
    - subject: WG
    - free: true
    - subject: Chor
    - subject: Handball
    - free: true
    - free: true
```

---

## ⚙️ Options

### General

| Name                  | Type     | Default | Description                                                  |
|-----------------------|----------|---------|--------------------------------------------------------------|
| `type`                | string   | —       | Required. Must be `custom:student-schedule-card`             |
| `name`                | string   | —       | Card title (if no `person_entity` is set)                    |
| `description`         | string   | —       | Subtitle below the name/avatar                               |
| `icon`                | string   | —       | Icon to show if no `person_entity` is used                   |
| `person_entity`       | string   | —       | A person entity (e.g. `person.jan`)                          |
| `schedule_entity`     | string   | —       | Optional entity whose attributes override `days`, `times`, `breaks`, `subjects`, `colors`, `break_label` and `description` (see below) |
| `default_placeholder` | string   | `--`    | Placeholder text for empty subjects                          |

### Layout

| Name                  | Type    | Default | Description                                                  |
|-----------------------|---------|---------|--------------------------------------------------------------|
| `show_breaks`         | bool    | true    | Show break rows                                              |
| `break_label`         | string  | "Pause" | Label for breaks                                             |
| `show_rooms`          | bool    | true    | Show room info below subject name                            |
| `shorten_room_names`  | bool    | true    | Shorten room names if layout is narrow                       |
| `show_highlight`      | bool    | true    | Highlight current day and ongoing lesson                     |
| `first_day_of_week`   | string  | monday  | `monday` or `sunday`; used to match days by position when no weekday can be detected |
| `mobile_view`         | bool    | false   | On narrow screens (< 480px) show one day at a time with previous/next buttons |
| `rtl`                 | bool    | false   | Right-to-left layout (e.g. Hebrew, Arabic)                   |

### Data

| Name       | Type     | Description                                                  |
|------------|----------|--------------------------------------------------------------|
| `days`     | string[] \| object[] | List of day labels, or objects `{ label, day, enabled }` (see below) |
| `times`    | string[] | Time slot definitions (format: `HH:mm - HH:mm`)             |
| `breaks`   | string[] | Optional break time slots                                   |
| `colors`   | object   | Map subject → hex color                                      |
| `subjects` | object   | Map of day (1–7) → array of subject objects or strings       |

### Day objects

Each entry in `days` can be a plain string (as before) or an object:

```yaml
days:
  - label: Sun          # text shown in the card
    day: sunday         # weekday used to highlight "today" (optional, auto-detected from the label)
  - label: Mon
    day: monday
  - label: Sat
    day: saturday
    enabled: false      # keep the column's subjects but hide it
```

Subjects are still keyed by the position of the day in this list (`"1"` = first entry), so hiding a day never shifts the data of the other days.

---

## 📡 Loading the schedule from a sensor (`schedule_entity`)

Instead of storing the timetable in the card, you can point the card at an entity. Any of the attributes
`days`, `times`, `breaks`, `subjects`, `colors`, `break_label` and `description` found on that entity
override the card config; everything else (name, layout options, ...) still comes from the card.
When `schedule_entity` is set, `days`, `times` and `subjects` are no longer required in the card config.

Useful to reuse one timetable on several dashboards, to switch between week A and B with a template,
or to fill the schedule from another integration.

```yaml
type: custom:student-schedule-card
schedule_entity: sensor.jan_schedule
person_entity: person.jan
show_breaks: true
```

Example template sensor (`configuration.yaml`):

```yaml
template:
  - sensor:
      - name: Jan schedule
        unique_id: jan_schedule
        state: "ok"
        attributes:
          description: Week A
          days: >-
            {{ ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] }}
          times: >-
            {{ ["8:00 - 8:45", "8:45 - 9:30", "9:50 - 10:35"] }}
          breaks: >-
            {{ ["9:30 - 9:50"] }}
          subjects: >-
            {{ {
              "1": [{"subject": "Math", "room": "101"}, {"subject": "English"}, {"free": true}],
              "2": [{"subject": "Science"}, {"subject": "Music"}, {"subject": "Art"}]
            } }}
          colors: >-
            {{ {"Math": "#2196f3", "English": "#4caf50", "FREE": "#cccccc"} }}
```

If the entity does not exist or lacks `days`/`times`/`subjects`, the card shows a warning instead of failing.

---

## 🐞 Troubleshooting

If the card doesn't show up:

- Check Dev Tools → Console for errors
- Clear your browser cache
- Confirm that the `type` is set correctly
- Make sure the resource path and version match

```yaml
type: custom:student-schedule-card
```
## 🐞 Bug Reports & Feature Requests

Please open an issue here:
👉 https://github.com/DomCim/student-schedule-card/issues

---

## 📄 License

MIT © 2025

---

_Developed with ❤️ for Home Assistant_
