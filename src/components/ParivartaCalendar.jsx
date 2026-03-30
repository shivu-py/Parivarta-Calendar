import React, { useEffect, useMemo, useState } from 'react';
import './ParivartaCalendar.css';
import {
  DAY_MS,
  absoluteDayIndexToUtcDate,
  buildParivartaYear,
  explainGregorianUtcToParivarta,
  formatUtcDate,
  getBirthdayOccurrencesInParivartaYear,
  getParivartaYearBounds,
  getTodayUtcDate,
  gregorianUtcToParivarta,
  parseUtcDate,
} from '../utils/parivartaCalendar';

const WEEK_LABELS = Array.from({ length: 23 }, (_, index) =>
  `W${String(index + 1).padStart(2, '0')}`
);

const BIRTHDAYS_STORAGE_KEY = 'parivarta.birthdays';
const HABITS_STORAGE_KEY = 'parivarta.habits';
const HABIT_COMPLETIONS_STORAGE_KEY = 'parivarta.habit-completions';

function getInitialBirthdayEntries() {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(BIRTHDAYS_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (entry) =>
        entry &&
        typeof entry.id === 'string' &&
        typeof entry.name === 'string' &&
        typeof entry.gregorianDate === 'string'
    );
  } catch (error) {
    return [];
  }
}

function getInitialHabitEntries() {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(HABITS_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (entry) =>
        entry &&
        typeof entry.id === 'string' &&
        typeof entry.name === 'string' &&
        Number.isInteger(entry.startAbsoluteDayIndex) &&
        typeof entry.startUtcDate === 'string'
    );
  } catch (error) {
    return [];
  }
}

function getInitialHabitCompletions() {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const stored = window.localStorage.getItem(HABIT_COMPLETIONS_STORAGE_KEY);
    if (!stored) {
      return {};
    }

    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([key, value]) => typeof key === 'string' && typeof value === 'boolean'
      )
    );
  } catch (error) {
    return {};
  }
}

function createBirthdayId() {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `birthday-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createHabitId() {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `habit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function describeBirthday(entry) {
  return entry.name.trim() || entry.gregorianDate;
}

function getHabitCompletionKey(habitId, absoluteDayIndex) {
  return `${habitId}:${absoluteDayIndex}`;
}

function getVisibleHabitsForDay(habits, absoluteDayIndex) {
  return habits
    .filter((habit) => habit.startAbsoluteDayIndex <= absoluteDayIndex)
    .sort(
      (left, right) =>
        left.startAbsoluteDayIndex - right.startAbsoluteDayIndex ||
        left.name.localeCompare(right.name)
    );
}

function getHabitProgressSnapshot(
  habit,
  absoluteDayIndex,
  yearStartAbsoluteDay,
  yearEndAbsoluteDay,
  habitCompletions
) {
  const trackingStartAbsoluteDay = Math.max(habit.startAbsoluteDayIndex, yearStartAbsoluteDay);
  const completedWindowDays = absoluteDayIndex - trackingStartAbsoluteDay + 1;

  if (completedWindowDays <= 0) {
    return null;
  }

  let completedDays = 0;

  for (let dayIndex = trackingStartAbsoluteDay; dayIndex <= absoluteDayIndex; dayIndex += 1) {
    if (habitCompletions[getHabitCompletionKey(habit.id, dayIndex)]) {
      completedDays += 1;
    }
  }

  const consistencyBaseDays = Math.max(1, yearEndAbsoluteDay - trackingStartAbsoluteDay);
  const completionRate = completedDays / consistencyBaseDays;

  return {
    ...habit,
    completedDays,
    completionRate,
    isDoneToday: Boolean(habitCompletions[getHabitCompletionKey(habit.id, absoluteDayIndex)]),
    percentage: Math.round(completionRate * 100),
    consistencyBaseDays,
    completedWindowDays,
    trackingStartAbsoluteDay,
    trackingStartUtcDate: absoluteDayIndexToUtcDate(trackingStartAbsoluteDay),
  };
}

function polarPoint(angle, radius, size) {
  const center = size / 2;
  const x = center + Math.cos(angle) * radius;
  const y = center + Math.sin(angle) * radius;
  return `${x},${y}`;
}

function HabitRadarChart({ metrics }) {
  const size = 240;
  const center = size / 2;
  const radius = 84;
  const axisCount = Math.max(metrics.length, 3);
  const levels = [0.25, 0.5, 0.75, 1];

  const gridPolygons = levels.map((level) =>
    Array.from({ length: axisCount }, (_, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / axisCount;
      return polarPoint(angle, radius * level, size);
    }).join(' ')
  );

  const plotValues = Array.from(
    { length: axisCount },
    (_, index) => metrics[index]?.completionRate ?? 0
  );
  const dataPolygon = plotValues
    .map((value, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / axisCount;
      return polarPoint(angle, radius * value, size);
    })
    .join(' ');

  return (
    <div className="habit-radar">
      <div className="habit-radar-visual">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label="Habit consistency radar chart"
        >
          <defs>
            <linearGradient id="habit-radar-fill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--blue)" stopOpacity="0.38" />
              <stop offset="100%" stopColor="var(--green)" stopOpacity="0.14" />
            </linearGradient>
          </defs>

          {gridPolygons.map((points, index) => (
            <polygon className="habit-radar-grid" key={levels[index]} points={points} />
          ))}

          {Array.from({ length: axisCount }, (_, index) => {
            const angle = -Math.PI / 2 + (Math.PI * 2 * index) / axisCount;
            const endPoint = polarPoint(angle, radius, size).split(',');

            return (
              <line
                className="habit-radar-axis"
                key={`axis-${levels.length}-${index}`}
                x1={center}
                y1={center}
                x2={Number(endPoint[0])}
                y2={Number(endPoint[1])}
              />
            );
          })}

          <polygon className="habit-radar-shape" points={dataPolygon} />

          {plotValues.map((value, index) => {
            const angle = -Math.PI / 2 + (Math.PI * 2 * index) / axisCount;
            const point = polarPoint(angle, radius * value, size).split(',');

            const pointColor = ['var(--blue)', 'var(--green)', 'var(--red)', 'var(--yellow)', 'var(--indigo)'][index % 5];
            return (
              <circle
                className="habit-radar-point"
                cx={Number(point[0])}
                cy={Number(point[1])}
                key={`point-${metrics[index]?.id ?? index}`}
                r="2.5"
                style={{ fill: pointColor }}
              />
            );
          })}
        </svg>
      </div>

      <div className="habit-radar-labels" aria-hidden="true">
        {metrics.map((metric) => (
          <div className="habit-radar-label" key={metric.id}>
            <div>
              <strong>{metric.name}</strong>
              <small>
                {metric.completedDays}/{metric.consistencyBaseDays} this year
              </small>
            </div>
            <span>{metric.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ParivartaCalendar({ theme, onToggleTheme }) {
  const [utcDate, setUtcDate] = useState(getTodayUtcDate);
  const [viewYear, setViewYear] = useState(() => gregorianUtcToParivarta(getTodayUtcDate()).year);
  const [birthdays, setBirthdays] = useState(getInitialBirthdayEntries);
  const [birthdayName, setBirthdayName] = useState('');
  const [birthdayUtcDate, setBirthdayUtcDate] = useState(getTodayUtcDate);
  const [calculationTarget, setCalculationTarget] = useState({ type: 'selected-date' });
  const [habitDefinitions, setHabitDefinitions] = useState(getInitialHabitEntries);
  const [habitCompletions, setHabitCompletions] = useState(getInitialHabitCompletions);
  const [activeDateCardUtcDate, setActiveDateCardUtcDate] = useState(null);
  const [newHabitName, setNewHabitName] = useState('');

  const selectedDate = useMemo(() => gregorianUtcToParivarta(utcDate), [utcDate]);
  const selectedDateExplanation = useMemo(
    () => explainGregorianUtcToParivarta(utcDate),
    [utcDate]
  );
  const yearModel = useMemo(() => buildParivartaYear(viewYear), [viewYear]);
  const viewedYearBounds = useMemo(() => getParivartaYearBounds(viewYear), [viewYear]);
  const activeDateCard = useMemo(() => {
    if (!activeDateCardUtcDate) {
      return null;
    }

    return {
      utcDate: activeDateCardUtcDate,
      parivartaDate: gregorianUtcToParivarta(activeDateCardUtcDate),
    };
  }, [activeDateCardUtcDate]);
  const activeDateYearBounds = useMemo(() => {
    if (!activeDateCard) {
      return null;
    }

    return getParivartaYearBounds(activeDateCard.parivartaDate.year);
  }, [activeDateCard]);

  const activeDateHabits = useMemo(() => {
    if (!activeDateCard) {
      return [];
    }

    return getVisibleHabitsForDay(
      habitDefinitions,
      activeDateCard.parivartaDate.absoluteDayIndex
    );
  }, [activeDateCard, habitDefinitions]);

  const activeHabitMetrics = useMemo(() => {
    if (!activeDateCard) {
      return [];
    }

    return activeDateHabits
      .map((habit) =>
        getHabitProgressSnapshot(
          habit,
          activeDateCard.parivartaDate.absoluteDayIndex,
          activeDateYearBounds.startAbsoluteDay,
          activeDateYearBounds.endAbsoluteDay,
          habitCompletions
        )
      )
      .filter(Boolean);
  }, [activeDateCard, activeDateHabits, activeDateYearBounds, habitCompletions]);

  const habitsDoneTodayCount = activeHabitMetrics.filter((habit) => habit.isDoneToday).length;
  const overallHabitMetrics = useMemo(
    () =>
      getVisibleHabitsForDay(habitDefinitions, selectedDate.absoluteDayIndex)
        .map((habit) =>
          getHabitProgressSnapshot(
            habit,
            selectedDate.absoluteDayIndex,
            viewedYearBounds.startAbsoluteDay,
            viewedYearBounds.endAbsoluteDay,
            habitCompletions
          )
        )
        .filter(Boolean),
    [
      habitDefinitions,
      habitCompletions,
      selectedDate.absoluteDayIndex,
      viewedYearBounds.endAbsoluteDay,
      viewedYearBounds.startAbsoluteDay,
    ]
  );
  const overallHabitsDoneCount = overallHabitMetrics.filter((habit) => habit.isDoneToday).length;
  const overallConsistency = overallHabitMetrics.length
    ? Math.round(
        overallHabitMetrics.reduce((sum, habit) => sum + habit.percentage, 0) /
          overallHabitMetrics.length
      )
    : 0;

  const birthdayConversions = useMemo(
    () =>
      birthdays.map((entry) => {
        try {
          return {
            entry,
            result: getBirthdayOccurrencesInParivartaYear(entry.gregorianDate, viewYear),
          };
        } catch (error) {
          return {
            entry,
            error: error instanceof Error ? error.message : 'Unable to convert birthday.',
          };
        }
      }),
    [birthdays, viewYear]
  );

  const birthdayMarkerMap = useMemo(() => {
    const markers = new Map();

    birthdayConversions.forEach((conversion) => {
      conversion.result?.occurrences?.forEach((occurrence) => {
        const {
          parivartaDate: { year, period, day },
        } = occurrence;
        const markerKey = `${year}:${period}:${day}`;
        const existing = markers.get(markerKey) ?? [];
        existing.push(describeBirthday(conversion.entry));
        markers.set(markerKey, existing);
      });
    });

    return markers;
  }, [birthdayConversions]);

  const activeBirthdayConversion =
    calculationTarget.type === 'birthday'
      ? birthdayConversions.find(({ entry }) => entry.id === calculationTarget.id) ?? null
      : null;
  const activeBirthdayOccurrence = activeBirthdayConversion?.result?.occurrences?.[0] ?? null;
  const activeBirthdayIsValid = Boolean(activeBirthdayOccurrence);

  const calculationExplanation = activeBirthdayIsValid
    ? activeBirthdayOccurrence.explanation
    : selectedDateExplanation;

  const calculationTitle = activeBirthdayIsValid
    ? `${describeBirthday(activeBirthdayConversion.entry)} in Parivarta year ${viewYear}`
    : activeBirthdayConversion
      ? `${describeBirthday(activeBirthdayConversion.entry)} has no occurrence in Parivarta year ${viewYear}`
      : 'Selected Gregorian date';

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(BIRTHDAYS_STORAGE_KEY, JSON.stringify(birthdays));
  }, [birthdays]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(habitDefinitions));
  }, [habitDefinitions]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      HABIT_COMPLETIONS_STORAGE_KEY,
      JSON.stringify(habitCompletions)
    );
  }, [habitCompletions]);

  useEffect(() => {
    if (
      calculationTarget.type === 'birthday' &&
      !birthdays.some((entry) => entry.id === calculationTarget.id)
    ) {
      setCalculationTarget({ type: 'selected-date' });
    }
  }, [birthdays, calculationTarget]);

  useEffect(() => {
    if (!activeDateCardUtcDate) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setActiveDateCardUtcDate(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeDateCardUtcDate]);

  function shiftUtcDay(deltaDays) {
    const current = parseUtcDate(utcDate);
    const shifted = new Date(current.getTime() + deltaDays * DAY_MS);
    setUtcDate(formatUtcDate(shifted));
    setCalculationTarget({ type: 'selected-date' });
  }

  function addBirthday(event) {
    event.preventDefault();

    const nextEntry = {
      id: createBirthdayId(),
      name: birthdayName.trim(),
      gregorianDate: birthdayUtcDate,
    };

    setBirthdays((currentBirthdays) => [...currentBirthdays, nextEntry]);
    setBirthdayName('');
    setCalculationTarget({ type: 'birthday', id: nextEntry.id });
  }

  function addHabit(event) {
    event.preventDefault();

    if (!activeDateCard) {
      return;
    }

    const trimmedName = newHabitName.trim();

    if (!trimmedName) {
      return;
    }

    const nextHabit = {
      id: createHabitId(),
      name: trimmedName,
      startAbsoluteDayIndex: activeDateCard.parivartaDate.absoluteDayIndex,
      startUtcDate: activeDateCard.utcDate,
    };

    setHabitDefinitions((currentHabits) => [...currentHabits, nextHabit]);
    setNewHabitName('');
  }

  function removeBirthday(id) {
    setBirthdays((currentBirthdays) => currentBirthdays.filter((entry) => entry.id !== id));
  }

  function focusBirthday(conversion) {
    const occurrence = conversion.result?.occurrences?.[0];

    if (!occurrence) {
      setCalculationTarget({ type: 'birthday', id: conversion.entry.id });
      return;
    }

    setUtcDate(occurrence.occurrenceUtcDate);
    setViewYear(occurrence.parivartaDate.year);
    setCalculationTarget({ type: 'birthday', id: conversion.entry.id });
  }

  function openDateCard(absoluteDayIndex) {
    if (!Number.isFinite(absoluteDayIndex)) {
      return;
    }

    const dayUtcDate = absoluteDayIndexToUtcDate(absoluteDayIndex);
    const dayParivartaDate = gregorianUtcToParivarta(dayUtcDate);

    setUtcDate(dayUtcDate);
    setViewYear(dayParivartaDate.year);
    setCalculationTarget({ type: 'selected-date' });
    setActiveDateCardUtcDate(dayUtcDate);
  }

  function toggleHabitCompletion(habitId, absoluteDayIndex) {
    const completionKey = getHabitCompletionKey(habitId, absoluteDayIndex);

    setHabitCompletions((currentCompletions) => ({
      ...currentCompletions,
      [completionKey]: !currentCompletions[completionKey],
    }));
  }

  function handleExport() {
    const data = {
      birthdays: JSON.parse(localStorage.getItem(BIRTHDAYS_STORAGE_KEY) || '[]'),
      habits: JSON.parse(localStorage.getItem(HABITS_STORAGE_KEY) || '[]'),
      completions: JSON.parse(localStorage.getItem(HABIT_COMPLETIONS_STORAGE_KEY) || '{}'),
      exportDate: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `parivarta-data-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);

        if (Array.isArray(data.birthdays)) {
          setBirthdays(data.birthdays);
        }
        if (Array.isArray(data.habits)) {
          setHabitDefinitions(data.habits);
        }
        if (data.completions && typeof data.completions === 'object') {
          setHabitCompletions(data.completions);
        }

        alert('Memory successfully imported.');
      } catch (error) {
        alert('Failed to read the backup file. Please ensure it is a valid Parivarta data file.');
      }
    };
    reader.readAsText(file);

    // Reset the input so the same file can be selected again
    event.target.value = '';
  }

  function handleClearAllMemory() {
    const message =
      'Are you sure you want to erase all your saved birthdays and habits? This will permanently wipe the local memory of this application.';

    if (window.confirm(message)) {
      setBirthdays([]);
      setHabitDefinitions([]);
      setHabitCompletions({});
      localStorage.removeItem(BIRTHDAYS_STORAGE_KEY);
      localStorage.removeItem(HABITS_STORAGE_KEY);
      localStorage.removeItem(HABIT_COMPLETIONS_STORAGE_KEY);
    }
  }

  function handleClearHabitProgress() {
    if (
      window.confirm(
        'Are you sure you want to clear ALL habit progress? This cannot be undone.'
      )
    ) {
      setHabitCompletions({});
      localStorage.removeItem(HABIT_COMPLETIONS_STORAGE_KEY);
    }
  }

  function shiftDateCard(deltaDays) {
    if (!activeDateCardUtcDate) {
      return;
    }
    const current = parseUtcDate(activeDateCardUtcDate);
    const shifted = new Date(current.getTime() + deltaDays * DAY_MS);
    const shiftedUtc = formatUtcDate(shifted);
    setActiveDateCardUtcDate(shiftedUtc);
    setUtcDate(shiftedUtc);
    setCalculationTarget({ type: 'selected-date' });
  }

  return (
    <section className="parivarta-calendar">
      <header className="calendar-hero">
        <div className="hero-top">
          <div className="hero-content">
            <h1>Parivarta Calendar</h1>
            <p className="hero-description">
              Solar calendar with 23-day continuous weeks, starting from the 2000 March equinox.
            </p>
          </div>
          <button
            type="button"
            className={`theme-toggle theme-toggle-${theme}`}
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            aria-pressed={theme === 'dark'}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            <span className="theme-toggle-copy">
              <strong>{theme === 'light' ? 'Light' : 'Dark'}</strong>
              <span>Mode</span>
            </span>
            <span className="theme-toggle-track" aria-hidden="true">
              <span className={`theme-toggle-icon ${theme === 'light' ? 'is-active' : ''}`}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="4.5" />
                  <line x1="12" y1="1.5" x2="12" y2="4" />
                  <line x1="12" y1="20" x2="12" y2="22.5" />
                  <line x1="4.22" y1="4.22" x2="6" y2="6" />
                  <line x1="18" y1="18" x2="19.78" y2="19.78" />
                  <line x1="1.5" y1="12" x2="4" y2="12" />
                  <line x1="20" y1="12" x2="22.5" y2="12" />
                  <line x1="4.22" y1="19.78" x2="6" y2="18" />
                  <line x1="18" y1="6" x2="19.78" y2="4.22" />
                </svg>
              </span>
              <span className={`theme-toggle-icon ${theme === 'dark' ? 'is-active' : ''}`}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12.2A8.8 8.8 0 1 1 11.8 3a6.9 6.9 0 0 0 9.2 9.2z" />
                </svg>
              </span>
            </span>
          </button>
        </div>
      </header>

      <div className="dashboard">
        <article className="panel">
          <h2>Gregorian Input (UTC)</h2>
          <label htmlFor="utc-date">Date</label>
          <input
            id="utc-date"
            type="date"
            value={utcDate}
            onChange={(event) => {
              setUtcDate(event.target.value);
              setCalculationTarget({ type: 'selected-date' });
            }}
          />
          <div className="button-row">
            <button type="button" onClick={() => shiftUtcDay(-1)}>
              Previous UTC Day
            </button>
            <button
              type="button"
              onClick={() => {
                setUtcDate(getTodayUtcDate());
                setCalculationTarget({ type: 'selected-date' });
              }}
            >
              Today (UTC)
            </button>
            <button type="button" onClick={() => shiftUtcDay(1)}>
              Next UTC Day
            </button>
          </div>
        </article>

        <article className="panel">
          <h2>Converted Date</h2>
          <p className="big-value">{selectedDate.format}</p>
          <div className="meta-grid">
            <p>
              <span>Year Length</span>
              <strong>{selectedDate.isLeapYear ? '366 (Leap)' : '365 (Common)'}</strong>
            </p>
            <p>
              <span>Day of Year</span>
              <strong>{selectedDate.dayOfYear}</strong>
            </p>
            <p>
              <span>Week Cycle Day</span>
              <strong>
                {selectedDate.weekDay} ({WEEK_LABELS[selectedDate.weekDay - 1]})
              </strong>
            </p>
            <p>
              <span>Absolute Days from Epoch</span>
              <strong>{selectedDate.absoluteDayIndex}</strong>
            </p>
          </div>
        </article>
      </div>

      <div className="detail-grid">
        <article className="panel">
          <div className="panel-head">
            <h2>Birthday Markers</h2>
          </div>

          <form className="birthday-form" onSubmit={addBirthday}>
            <div className="form-grid">
              <div>
                <label htmlFor="birthday-name">Label</label>
                <input
                  id="birthday-name"
                  type="text"
                  value={birthdayName}
                  onChange={(event) => setBirthdayName(event.target.value)}
                  placeholder="Asha"
                />
              </div>
              <div>
                <label htmlFor="birthday-date">Gregorian birthday</label>
                <input
                  id="birthday-date"
                  type="date"
                  value={birthdayUtcDate}
                  onChange={(event) => setBirthdayUtcDate(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="button-row">
              <button type="submit">Add Birthday</button>
              <button type="button" onClick={() => setViewYear(selectedDate.year)}>
                Show Selected Date Year
              </button>
            </div>
          </form>

          <div className="birthday-list" role="list">
            {birthdayConversions.length === 0 ? (
              <p className="empty-state">
                No birthdays saved yet. Add one above and it will be marked automatically in each
                Parivarta year as you browse.
              </p>
            ) : (
              birthdayConversions.map((conversion) => {
                const label = describeBirthday(conversion.entry);
                const occurrence = conversion.result?.occurrences?.[0] ?? null;

                return (
                  <article className="birthday-card" key={conversion.entry.id} role="listitem">
                    <div className="birthday-card-copy">
                      <h3>{label}</h3>
                      <p>Born on {conversion.entry.gregorianDate}</p>
                      {occurrence ? (
                        <p>
                          In Parivarta year {viewYear}, <strong>{occurrence.occurrenceUtcDate}</strong>{' '}
                          becomes <strong>{occurrence.parivartaDate.format}</strong>.
                        </p>
                      ) : (
                        <p className="birthday-warning">
                          No valid occurrence falls inside this displayed Parivarta year. This can
                          happen for birthdays like February 29 when the overlapping Gregorian years
                          are not leap years.
                        </p>
                      )}
                    </div>

                    <div className="button-row birthday-actions">
                      <button
                        type="button"
                        onClick={() =>
                          setCalculationTarget({ type: 'birthday', id: conversion.entry.id })
                        }
                      >
                        Show Steps
                      </button>
                      <button type="button" onClick={() => focusBirthday(conversion)}>
                        {occurrence ? 'Open on Calendar' : 'Focus Entry'}
                      </button>
                      <button type="button" onClick={() => removeBirthday(conversion.entry.id)}>
                        Remove
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </article>

        <article className="panel">
          <h2>Calculation</h2>
          <p className="panel-copy">
            {activeBirthdayIsValid
              ? 'Based on the birthday occurrence within this Parivarta year.'
              : 'Direct conversion from the Gregorian date.'}
          </p>

          {activeBirthdayConversion && !activeBirthdayIsValid ? (
            <p className="birthday-warning panel-copy">
              {describeBirthday(activeBirthdayConversion.entry)} has no valid occurrence inside
              Parivarta year {viewYear}. This usually only affects leap-day birthdays in
              non-leap Gregorian years.
            </p>
          ) : null}

          <div className="calculation-summary">
            <p>
              <span>Working Date</span>
              <strong>{calculationExplanation.utcDateString}</strong>
            </p>
            <p>
              <span>Result</span>
              <strong>{calculationExplanation.formattedParivartaDate}</strong>
            </p>
            <p>
              <span>Context</span>
              <strong>{calculationTitle}</strong>
            </p>
          </div>

          <ol className="calculation-steps">
            <li>
              <code>
                absolute day index = {calculationExplanation.utcDateString} -{' '}
                {calculationExplanation.epochUtcDate} = {calculationExplanation.absoluteDayIndex}
              </code>
            </li>
            <li>
              <code>
                day of year = {calculationExplanation.absoluteDayIndex} - (
                {calculationExplanation.yearStartAbsoluteDay}) + 1 ={' '}
                {calculationExplanation.dayOfYear}
              </code>
              , so the date is in Parivarta year <strong>{calculationExplanation.year}</strong>.
            </li>
            <li>
              Period ranges:
              <code> Arocha 1-92</code>,<code> Sthira 93-184</code>,
              <code> Nivarta 185-276</code>,<code> Aniyama 277-{calculationExplanation.yearLength}</code>.
              Since day <strong>{calculationExplanation.dayOfYear}</strong> falls there, the date is{' '}
              <strong>
                {calculationExplanation.period} {calculationExplanation.dayInPeriod}
              </strong>
              .
            </li>
            <li>
              <code>
                week day = ({calculationExplanation.absoluteDayIndex} mod 23) + 1 ={' '}
                {calculationExplanation.weekDay}
              </code>
              , so the label is{' '}
              <strong>
                {calculationExplanation.weekDay} (
                {WEEK_LABELS[calculationExplanation.weekDay - 1]})
              </strong>
              .
            </li>
          </ol>
        </article>
      </div>

      <section className="habit-overview-section">
        <article className="panel">
          <div className="panel-head">
            <div>
              <h2>Overall Habit Progress</h2>
              <p className="panel-copy">
                This polygon tracks all habits active through <code>{utcDate}</code>. Change the
                selected date above to view your overall consistency at any point in the calendar.
              </p>
            </div>
          </div>

          <div className="date-card-summary">
            <p>
              <span>Tracked Habits</span>
              <strong>{overallHabitMetrics.length}</strong>
            </p>
            <p>
              <span>Done On {utcDate}</span>
              <strong>
                {overallHabitsDoneCount}/{overallHabitMetrics.length || 0}
              </strong>
            </p>
            <p>
              <span>Average Consistency</span>
              <strong>{overallConsistency}%</strong>
            </p>
          </div>

          <div className="habit-graph-card">
            <h3>Polygon Progress</h3>
            <p>
              Each corner represents one active habit, and each edge shows its cumulative
              completion rate for this Parivarta year using:
              <code> done count this year / remaining days in this year from the add date</code>.
            </p>
            {overallHabitMetrics.length > 0 ? (
              <HabitRadarChart metrics={overallHabitMetrics} />
            ) : (
              <p className="empty-state">
                Add a habit from any date card to start building your overall progress graph.
              </p>
            )}
          </div>
        </article>
      </section>

      <section className="year-section">
        <div className="year-header">
          <h2>Parivarta Year {viewYear}</h2>
          <div className="button-row">
            <button type="button" onClick={() => setViewYear((year) => year - 1)}>
              Previous Year
            </button>
            <button type="button" onClick={() => setViewYear(selectedDate.year)}>
              Jump to Selected Date Year
            </button>
            <button type="button" onClick={() => setViewYear((year) => year + 1)}>
              Next Year
            </button>
          </div>
        </div>

        <p className="year-meta">
          {yearModel.yearLength} days total. Aniyama length: {yearModel.aniyamaLength} days.
          Birthday markers shown here are automatic for Gregorian dates between{' '}
          {viewedYearBounds.startUtcDate} and {viewedYearBounds.endUtcDate}. Click any date to
          open its habit card.
        </p>

        <div className="period-list">
          {yearModel.periods.map((period) => (
            <article
              className={`period-card period-card-${period.name.toLowerCase()}`}
              key={period.name}
            >
              <header>
                <h3>{period.name}</h3>
                <p>{period.length} days</p>
              </header>

              <div className="period-grid" role="list">
                {period.days.map((day) => {
                  const isSelected =
                    selectedDate.year === viewYear &&
                    selectedDate.period === period.name &&
                    selectedDate.day === day.dayInPeriod;
                  const birthdayMarkerKey = `${viewYear}:${period.name}:${day.dayInPeriod}`;
                  const birthdayNames = birthdayMarkerMap.get(birthdayMarkerKey) ?? [];
                  const hasBirthday = birthdayNames.length > 0;
                  const activeHabitCount = getVisibleHabitsForDay(
                    habitDefinitions,
                    day.absoluteDayIndex
                  ).length;
                  const titleParts = [
                    `Open ${viewYear}-${period.name}-${String(day.dayInPeriod).padStart(2, '0')}`,
                    hasBirthday ? `Birthdays: ${birthdayNames.join(', ')}` : null,
                    activeHabitCount > 0
                      ? `${activeHabitCount} tracked habit${activeHabitCount === 1 ? '' : 's'}`
                      : 'No habits yet',
                  ].filter(Boolean);

                  return (
                    <button
                      type="button"
                      className={`day-cell day-cell-button ${isSelected ? 'day-cell-selected' : ''} ${hasBirthday ? 'day-cell-birthday' : ''}`}
                      key={day.dayOfYear}
                      title={titleParts.join(' | ')}
                      onClick={() => openDateCard(day.absoluteDayIndex)}
                    >
                      <div className="day-cell-top">
                        <span>{String(day.dayInPeriod).padStart(2, '0')}</span>
                        <div className="day-cell-badges">
                          {activeHabitCount > 0 ? (
                            <em className="day-marker day-marker-habit">H{activeHabitCount}</em>
                          ) : null}
                          {hasBirthday ? (
                            <em className="day-marker day-marker-birthday">
                              {birthdayNames.length === 1 ? 'BD' : `B${birthdayNames.length}`}
                            </em>
                          ) : null}
                        </div>
                      </div>
                      <small>{WEEK_LABELS[day.weekDay - 1]}</small>
                    </button>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
        <article className="panel data-management">
          <h2>Data & Memory</h2>
          <p className="panel-copy">
            Your data is stored locally in your browser. Use these tools to back up your memory or
            clear it.
          </p>
          <div className="button-row">
            <button type="button" onClick={handleExport}>
              Export Backup
            </button>
            <label className="import-label">
              Import Backup
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                style={{ display: 'none' }}
              />
            </label>
            <button type="button" className="btn-secondary" onClick={handleClearHabitProgress}>
              Reset Habit Progress
            </button>
            <button type="button" className="btn-destructive" onClick={handleClearAllMemory}>
              Clear All Memory
            </button>
          </div>
        </article>
      </section>

      {activeDateCard ? (
        <div
          className="date-card-backdrop"
          role="presentation"
          onClick={() => setActiveDateCardUtcDate(null)}
        >
          <section
            className="date-card-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="date-card-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="date-card-header">
              <div className="date-card-header-main">
                <p className="date-card-kicker">DAY DETAIL</p>
                <div className="date-nav-container">
                  <button
                    type="button"
                    className="date-nav-btn"
                    onClick={() => shiftDateCard(-1)}
                    title="Previous Day"
                  >
                    ←
                  </button>
                  <h2 id="date-card-title">{activeDateCard.parivartaDate.format}</h2>
                  <button
                    type="button"
                    className="date-nav-btn"
                    onClick={() => shiftDateCard(1)}
                    title="Next Day"
                  >
                    →
                  </button>
                </div>
                <p className="date-card-copy">
                  Converted from <strong>{activeDateCard.utcDate}</strong>.
                </p>
              </div>
              <button
                type="button"
                className="date-card-close"
                onClick={() => setActiveDateCardUtcDate(null)}
                aria-label="Close date card"
              >
                Close
              </button>
            </div>

            <div className="date-card-summary">
              <p>
                <span>Week Label</span>
                <strong>
                  {activeDateCard.parivartaDate.weekDay} (
                  {WEEK_LABELS[activeDateCard.parivartaDate.weekDay - 1]})
                </strong>
              </p>
              <p>
                <span>Active Habits</span>
                <strong>{activeHabitMetrics.length}</strong>
              </p>
              <p>
                <span>Done Today</span>
                <strong>
                  {habitsDoneTodayCount}/{activeHabitMetrics.length || 0}
                </strong>
              </p>
            </div>

            <div className="date-card-main">
              <form className="habit-form" onSubmit={addHabit}>
                <label htmlFor="habit-name">Add a habit from this date forward</label>
                <div className="habit-form-row">
                  <input
                    id="habit-name"
                    type="text"
                    value={newHabitName}
                    onChange={(event) => setNewHabitName(event.target.value)}
                    placeholder="Read for 20 minutes"
                    required
                  />
                  <button type="submit">Add Habit</button>
                </div>
              </form>

              <div className="habit-list" role="list">
                {activeHabitMetrics.length === 0 ? (
                  <p className="empty-state">
                    No habits are active on this date yet. Add one above and it will carry into
                    every later day automatically.
                  </p>
                ) : (
                  activeHabitMetrics.map((habit) => (
                    <article className="habit-card" key={habit.id} role="listitem">
                      <div className="habit-card-top">
                        <div>
                          <h3>{habit.name}</h3>
                          <p>
                            Added from <strong>{habit.trackingStartUtcDate}</strong>. This year's
                            consistency base is <strong>{habit.consistencyBaseDays}</strong> day
                            {habit.consistencyBaseDays === 1 ? '' : 's'}.
                          </p>
                        </div>

                        <button
                          type="button"
                          className={`habit-toggle ${habit.isDoneToday ? 'habit-toggle-on' : ''}`}
                          role="switch"
                          aria-checked={habit.isDoneToday}
                          onClick={() =>
                            toggleHabitCompletion(
                              habit.id,
                              activeDateCard.parivartaDate.absoluteDayIndex
                            )
                          }
                        >
                          <span className="habit-toggle-thumb" aria-hidden="true" />
                          <span>{habit.isDoneToday ? 'Done today' : 'Mark done'}</span>
                        </button>
                      </div>

                      <div className="habit-stats">
                        <p>
                          <span>Completion</span>
                          <strong>{habit.percentage}%</strong>
                        </p>
                        <p>
                          <span>Done / Year Base</span>
                          <strong>
                            {habit.completedDays}/{habit.consistencyBaseDays}
                          </strong>
                        </p>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

export default ParivartaCalendar;
