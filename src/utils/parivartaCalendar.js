const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_LENGTH = 92;
const BASE_MONTH_DAYS = MONTH_LENGTH * 3;
const EPOCH_UTC_MS = Date.UTC(2000, 2, 20);

const PERIOD_DEFINITIONS = [
  { name: 'Arocha', startDayOfYear: 1, length: MONTH_LENGTH },
  { name: 'Sthira', startDayOfYear: 1 + MONTH_LENGTH, length: MONTH_LENGTH },
  { name: 'Nivarta', startDayOfYear: 1 + MONTH_LENGTH * 2, length: MONTH_LENGTH },
];

function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function padDay(value) {
  return String(value).padStart(2, '0');
}

export function isParivartaLeapYear(year) {
  return modulo(year, 4) === 0 && modulo(year, 128) !== 0;
}

export function getParivartaYearLength(year) {
  return isParivartaLeapYear(year) ? 366 : 365;
}

export function getAniyamaLength(year) {
  return getParivartaYearLength(year) - BASE_MONTH_DAYS;
}

export function formatUtcDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseUtcDate(utcDateString) {
  const parts = /^(-?\d+)-(\d{2})-(\d{2})$/.exec(utcDateString);
  if (!parts) {
    throw new Error(`Invalid UTC date format: ${utcDateString}`);
  }

  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid UTC date value: ${utcDateString}`);
  }

  return date;
}

export function daysSinceEpochFromUtc(utcDateString) {
  const date = parseUtcDate(utcDateString);
  return Math.floor((date.getTime() - EPOCH_UTC_MS) / DAY_MS);
}

export function getWeekCycleDay(absoluteDayIndex) {
  return modulo(absoluteDayIndex, 23) + 1;
}

export function getTodayUtcDate() {
  return formatUtcDate(new Date());
}

export function daysBeforeParivartaYear(targetYear) {
  let totalDays = 0;

  if (targetYear >= 0) {
    for (let year = 0; year < targetYear; year += 1) {
      totalDays += getParivartaYearLength(year);
    }
    return totalDays;
  }

  for (let year = -1; year >= targetYear; year -= 1) {
    totalDays -= getParivartaYearLength(year);
  }

  return totalDays;
}

export function gregorianUtcToParivarta(utcDateString) {
  const absoluteDayIndex = daysSinceEpochFromUtc(utcDateString);
  let year = 0;
  let dayIndexInYear = absoluteDayIndex;

  if (dayIndexInYear >= 0) {
    while (dayIndexInYear >= getParivartaYearLength(year)) {
      dayIndexInYear -= getParivartaYearLength(year);
      year += 1;
    }
  } else {
    while (dayIndexInYear < 0) {
      year -= 1;
      dayIndexInYear += getParivartaYearLength(year);
    }
  }

  const dayOfYear = dayIndexInYear + 1;
  const aniyamaStart = BASE_MONTH_DAYS + 1;
  const aniyamaLength = getAniyamaLength(year);
  const periods = [
    ...PERIOD_DEFINITIONS,
    { name: 'Aniyama', startDayOfYear: aniyamaStart, length: aniyamaLength },
  ];

  const period = periods.find(
    (entry) => dayOfYear >= entry.startDayOfYear && dayOfYear < entry.startDayOfYear + entry.length
  );

  if (!period) {
    throw new Error(`Failed to resolve period for day ${dayOfYear} in year ${year}`);
  }

  const dayInPeriod = dayOfYear - period.startDayOfYear + 1;

  return {
    year,
    dayOfYear,
    period: period.name,
    day: dayInPeriod,
    isLeapYear: isParivartaLeapYear(year),
    weekDay: getWeekCycleDay(absoluteDayIndex),
    absoluteDayIndex,
    format: `${year}-${period.name}-${padDay(dayInPeriod)}`,
  };
}

export function buildParivartaYear(year) {
  const yearStartAbsoluteDay = daysBeforeParivartaYear(year);
  const aniyamaLength = getAniyamaLength(year);
  const periodDefs = [
    ...PERIOD_DEFINITIONS,
    {
      name: 'Aniyama',
      startDayOfYear: BASE_MONTH_DAYS + 1,
      length: aniyamaLength,
    },
  ];

  const periods = periodDefs.map((period) => {
    const days = Array.from({ length: period.length }, (_, index) => {
      const dayInPeriod = index + 1;
      const dayOfYear = period.startDayOfYear + index;
      const absoluteDayIndex = yearStartAbsoluteDay + dayOfYear - 1;
      return {
        dayInPeriod,
        dayOfYear,
        weekDay: getWeekCycleDay(absoluteDayIndex),
      };
    });

    return {
      ...period,
      days,
    };
  });

  return {
    year,
    isLeapYear: isParivartaLeapYear(year),
    yearLength: getParivartaYearLength(year),
    aniyamaLength,
    periods,
  };
}

export { DAY_MS, EPOCH_UTC_MS };
