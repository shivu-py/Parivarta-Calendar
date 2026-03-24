# Parivarta Calendar

Parivarta Calendar is a React application for exploring a custom solar calendar system and converting UTC Gregorian dates into the Parivarta format.

The app is built for clarity and interaction: you can choose a UTC date, inspect the converted Parivarta date, browse an entire Parivarta year, and switch cleanly between light and dark mode.

## What The App Does

- Converts a UTC Gregorian date into a Parivarta date string like `12-Arocha-08`
- Displays year metadata including leap-year status, day of year, week-cycle day, and absolute day index
- Renders the full selected Parivarta year as period cards with per-day week labels
- Lets you jump between years or return to the selected date's year
- Includes persistent light/dark theme switching with system-theme fallback

## Calendar Model

This project currently implements a defined computational model for the Parivarta calendar:

- Epoch: the UTC day containing the March equinox of 2000 CE, implemented as `2000-03-20`
- Year length: `365` days in a common year and `366` days in a leap year
- Leap-year rule: a year is leap if `year % 4 === 0` and `year % 128 !== 0`
- Fixed period `Arocha`: 92 days
- Fixed period `Sthira`: 92 days
- Fixed period `Nivarta`: 92 days
- Variable period `Aniyama`: the remaining `89` or `90` days depending on leap year
- Week cycle: a continuous 23-day cycle labeled `W01` through `W23`

All date conversion logic lives in [`src/utils/parivartaCalendar.js`](src/utils/parivartaCalendar.js).

## Interface Overview

- `Gregorian Input (UTC)`: choose a date and move one UTC day backward or forward
- `Converted Date`: view the Parivarta representation and related metadata
- `Parivarta Year`: browse all periods and highlight the selected day
- `Theme Toggle`: switch between light and dark mode while preserving the same palette

Important note: the app intentionally works with UTC dates, not local calendar dates. This keeps conversion behavior deterministic across time zones.

## Tech Stack

- React 19
- Create React App
- Plain CSS with custom design tokens
- No backend or database

## Getting Started

### Prerequisites

- Node.js
- npm

### Installation

```bash
npm install
```

### Run In Development

```bash
npm start
```

Then open `http://localhost:3000`.

### Create A Production Build

```bash
npm run build
```

### Run Tests

```bash
npm test
```

## Available Scripts

- `npm start`: starts the development server
- `npm run dev`: alias for the development server
- `npm run build`: creates an optimized production build in `build/`
- `npm test`: launches the test runner

## Project Structure

```text
parivarta/
|- public/
|- src/
|  |- components/
|  |  |- ParivartaCalendar.jsx
|  |  |- ParivartaCalendar.css
|  |  |- Calander.jsx
|  |  `- Calander.css
|  |- utils/
|  |  `- parivartaCalendar.js
|  |- App.jsx
|  |- App.css
|  |- index.css
|  `- index.js
|- package.json
`- README.md
```

## Key Files

- [`src/App.jsx`](src/App.jsx): app shell and theme state management
- [`src/components/ParivartaCalendar.jsx`](src/components/ParivartaCalendar.jsx): main UI and interaction layer
- [`src/components/ParivartaCalendar.css`](src/components/ParivartaCalendar.css): theme tokens, component styling, and responsive behavior
- [`src/utils/parivartaCalendar.js`](src/utils/parivartaCalendar.js): conversion rules and year-generation utilities

## Theme Behavior

The theme system is designed to behave predictably:

- On first load, the app follows the system color scheme
- Once the user toggles the theme, that preference is stored locally
- The selected theme is applied consistently across both global background styling and component tokens

## Development Notes

- The displayed input is always UTC-based
- The selected day is highlighted inside the generated year view
- The repository includes an older `Calander` component that appears to be a legacy or experimental calendar view and is not the main interface used by the app today

## Build Status

The project builds successfully with:

```bash
npm run build
```

## License

This project is licensed under the terms of the [`LICENSE`](LICENSE) file.
