import React, { useMemo, useState } from 'react';
import './ParivartaCalendar.css';
import {
  DAY_MS,
  buildParivartaYear,
  formatUtcDate,
  getTodayUtcDate,
  gregorianUtcToParivarta,
  parseUtcDate,
} from '../utils/parivartaCalendar';

const WEEK_LABELS = Array.from({ length: 23 }, (_, index) =>
  `W${String(index + 1).padStart(2, '0')}`
);

function ParivartaCalendar() {
  const [utcDate, setUtcDate] = useState(getTodayUtcDate);
  const [viewYear, setViewYear] = useState(() => gregorianUtcToParivarta(getTodayUtcDate()).year);

  const selectedDate = useMemo(() => gregorianUtcToParivarta(utcDate), [utcDate]);
  const yearModel = useMemo(() => buildParivartaYear(viewYear), [viewYear]);

  function shiftUtcDay(deltaDays) {
    const current = parseUtcDate(utcDate);
    const shifted = new Date(current.getTime() + deltaDays * DAY_MS);
    setUtcDate(formatUtcDate(shifted));
  }

  return (
    <section className="parivarta-calendar">
      <header className="calendar-hero">
        <p className="kicker">Solar Model</p>
        <h1>Parivarta Calendar</h1>
        <p>
          Epoch: UTC day containing the March equinox of 2000 CE (implemented as{' '}
          <code>2000-03-20</code>). Weeks are continuous 23-day cycles.
        </p>
      </header>

      <div className="dashboard">
        <article className="panel">
          <h2>Gregorian Input (UTC)</h2>
          <label htmlFor="utc-date">Date</label>
          <input
            id="utc-date"
            type="date"
            value={utcDate}
            onChange={(event) => setUtcDate(event.target.value)}
          />
          <div className="button-row">
            <button type="button" onClick={() => shiftUtcDay(-1)}>
              Previous UTC Day
            </button>
            <button type="button" onClick={() => setUtcDate(getTodayUtcDate())}>
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
        </p>

        <div className="period-list">
          {yearModel.periods.map((period) => (
            <article
              className={`period-card ${period.name === 'Aniyama' ? 'period-card-aniyama' : ''}`}
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

                  return (
                    <div className={`day-cell ${isSelected ? 'day-cell-selected' : ''}`} key={day.dayOfYear}>
                      <span>{String(day.dayInPeriod).padStart(2, '0')}</span>
                      <small>{WEEK_LABELS[day.weekDay - 1]}</small>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

export default ParivartaCalendar;
