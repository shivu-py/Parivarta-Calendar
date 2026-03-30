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

function getPeriodDefinitionsForYear(year) {
  const aniyamaStart = BASE_MONTH_DAYS + 1;
  const aniyamaLength = getAniyamaLength(year);

  return [
    ...PERIOD_DEFINITIONS,
    { name: 'Aniyama', startDayOfYear: aniyamaStart, length: aniyamaLength },
  ];
}

function getPeriodForDayOfYear(year, dayOfYear) {
  const periods = getPeriodDefinitionsForYear(year);

  const period = periods.find(
    (entry) => dayOfYear >= entry.startDayOfYear && dayOfYear < entry.startDayOfYear + entry.length
  );

  if (!period) {
    throw new Error(`Failed to resolve period for day ${dayOfYear} in year ${year}`);
  }

  return period;
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

export function absoluteDayIndexToUtcDate(absoluteDayIndex) {
  return formatUtcDate(new Date(EPOCH_UTC_MS + absoluteDayIndex * DAY_MS));
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
  const period = getPeriodForDayOfYear(year, dayOfYear);
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

export function explainGregorianUtcToParivarta(utcDateString) {
  const parivartaDate = gregorianUtcToParivarta(utcDateString);
  const yearStartAbsoluteDay = daysBeforeParivartaYear(parivartaDate.year);
  const yearLength = getParivartaYearLength(parivartaDate.year);
  const period = getPeriodForDayOfYear(parivartaDate.year, parivartaDate.dayOfYear);
  const periodEndDay = period.startDayOfYear + period.length - 1;

  return {
    utcDateString,
    epochUtcDate: formatUtcDate(new Date(EPOCH_UTC_MS)),
    absoluteDayIndex: parivartaDate.absoluteDayIndex,
    year: parivartaDate.year,
    yearLength,
    yearStartAbsoluteDay,
    dayOfYear: parivartaDate.dayOfYear,
    zeroBasedDayIndexInYear: parivartaDate.dayOfYear - 1,
    period: parivartaDate.period,
    periodStartDay: period.startDayOfYear,
    periodEndDay,
    dayInPeriod: parivartaDate.day,
    weekDay: parivartaDate.weekDay,
    isLeapYear: parivartaDate.isLeapYear,
    formattedParivartaDate: parivartaDate.format,
  };
}

export function resolveGregorianBirthdayOccurrence(birthUtcDateString, gregorianYear) {
  const birthDate = parseUtcDate(birthUtcDateString);
  const occurrenceYear = Number(gregorianYear);

  if (!Number.isInteger(occurrenceYear)) {
    throw new Error(`Invalid Gregorian year: ${gregorianYear}`);
  }

  const birthMonth = birthDate.getUTCMonth() + 1;
  const birthDay = birthDate.getUTCDate();
  const occurrenceDate = new Date(Date.UTC(occurrenceYear, birthMonth - 1, birthDay));
  const isSameMonth = occurrenceDate.getUTCMonth() + 1 === birthMonth;
  const isSameDay = occurrenceDate.getUTCDate() === birthDay;

  if (!isSameMonth || !isSameDay) {
    return {
      isValid: false,
      occurrenceYear,
      reason: `${String(birthMonth).padStart(2, '0')}-${padDay(birthDay)} does not exist in Gregorian year ${occurrenceYear}.`,
    };
  }

  const occurrenceUtcDate = formatUtcDate(occurrenceDate);
  const parivartaDate = gregorianUtcToParivarta(occurrenceUtcDate);

  return {
    isValid: true,
    occurrenceYear,
    occurrenceUtcDate,
    birthMonth,
    birthDay,
    birthUtcDateString,
    ageTurning: occurrenceYear - birthDate.getUTCFullYear(),
    parivartaDate,
    explanation: explainGregorianUtcToParivarta(occurrenceUtcDate),
  };
}

export function getParivartaYearBounds(year) {
  const startAbsoluteDay = daysBeforeParivartaYear(year);
  const yearLength = getParivartaYearLength(year);
  const endAbsoluteDay = startAbsoluteDay + yearLength - 1;
  const startUtcDate = absoluteDayIndexToUtcDate(startAbsoluteDay);
  const endUtcDate = absoluteDayIndexToUtcDate(endAbsoluteDay);
  const gregorianYears = Array.from(
    new Set([
      parseUtcDate(startUtcDate).getUTCFullYear(),
      parseUtcDate(endUtcDate).getUTCFullYear(),
    ])
  );

  return {
    year,
    yearLength,
    startAbsoluteDay,
    endAbsoluteDay,
    startUtcDate,
    endUtcDate,
    gregorianYears,
  };
}

export function getBirthdayOccurrencesInParivartaYear(birthUtcDateString, parivartaYear) {
  const bounds = getParivartaYearBounds(parivartaYear);

  const occurrences = bounds.gregorianYears
    .map((gregorianYear) => resolveGregorianBirthdayOccurrence(birthUtcDateString, gregorianYear))
    .filter((occurrence) => {
      if (!occurrence.isValid) {
        return false;
      }

      const absoluteDayIndex = occurrence.parivartaDate.absoluteDayIndex;
      return (
        absoluteDayIndex >= bounds.startAbsoluteDay && absoluteDayIndex <= bounds.endAbsoluteDay
      );
    });

  return {
    ...bounds,
    occurrences,
  };
}

export function buildParivartaYear(year) {
  const yearStartAbsoluteDay = daysBeforeParivartaYear(year);
  const aniyamaLength = getAniyamaLength(year);
  const periodDefs = getPeriodDefinitionsForYear(year);

  const periods = periodDefs.map((period) => {
    const days = Array.from({ length: period.length }, (_, index) => {
      const dayInPeriod = index + 1;
      const dayOfYear = period.startDayOfYear + index;
      const absoluteDayIndex = yearStartAbsoluteDay + dayOfYear - 1;
      return {
        dayInPeriod,
        dayOfYear,
        absoluteDayIndex,
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
