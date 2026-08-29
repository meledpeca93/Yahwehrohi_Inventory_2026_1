const { execFileSync } = require('child_process');
const path = require('path');
const { listAttendanceUsers, savePayrollWeek } = require('../server/data-access');

const excelPath = process.argv[2] || 'C:\\Users\\InversionesYR\\Desktop\\SALARIOS 2026.xlsx';
const dryRun = process.argv.includes('--dry-run');
const dayGroups = [
  { name: 'Domingo', id: 'sunday', normal: 'B', extra1: 'C', extra2: 'D', extra3: 'E' },
  { name: 'Lunes', id: 'monday', normal: 'F', extra1: 'G', extra2: 'H', extra3: 'I' },
  { name: 'Martes', id: 'tuesday', normal: 'J', extra1: 'K', extra2: 'L', extra3: 'M' },
  { name: 'Miercoles', id: 'wednesday', normal: 'N', extra1: 'O', extra2: 'P', extra3: 'Q' },
  { name: 'Jueves', id: 'thursday', normal: 'R', extra1: 'S', extra2: 'T', extra3: 'U' },
  { name: 'Viernes', id: 'friday', normal: 'V', extra1: 'W', extra2: 'X', extra3: 'Y' },
  { name: 'Sabado', id: 'saturday', normal: 'Z', extra1: 'AA', extra2: 'AB', extra3: 'AC' },
];
const employeeRows = [4, 5, 6, 7];

function readZipEntry(entryName) {
  return execFileSync('tar', ['-xOf', excelPath, entryName], {
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024,
  });
}

function unescapeXml(value) {
  return String(value || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function cellNumber(value) {
  const normalized = Number(String(value ?? '').replace(',', '.').trim());
  return Number.isFinite(normalized) ? normalized : 0;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function sheetWeekNumber(sheetName) {
  const match = String(sheetName || '').match(/^S0?(\d+)_?26$/i);
  return match ? Number(match[1]) : 0;
}

function weekStartDate(weekNumber) {
  const firstPayrollSunday = new Date(Date.UTC(2025, 11, 28));
  const date = new Date(firstPayrollSunday);
  date.setUTCDate(firstPayrollSunday.getUTCDate() + (weekNumber - 1) * 7);
  return date;
}

function parseWorkbook() {
  const sharedXml = readZipEntry('xl/sharedStrings.xml');
  const sharedStrings = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    unescapeXml([...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((textMatch) => textMatch[1]).join('')),
  );
  const workbookXml = readZipEntry('xl/workbook.xml');
  const relsXml = readZipEntry('xl/_rels/workbook.xml.rels');
  const rels = new Map(
    [...relsXml.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map((match) => [
      match[1],
      match[2],
    ]),
  );

  return {
    sharedStrings,
    sheets: [...workbookXml.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*sheetId="([^"]+)"[^>]*r:id="([^"]+)"/g)]
      .map((match) => ({
        name: unescapeXml(match[1]),
        path: `xl/${rels.get(match[3]).replace(/^\//, '')}`,
      }))
      .filter((sheet) => sheetWeekNumber(sheet.name) > 0),
  };
}

function parseSheetCells(sheetPath, sharedStrings) {
  const sheetXml = readZipEntry(sheetPath);
  const cells = new Map();

  for (const cellMatch of sheetXml.matchAll(/<c\s((?![^>]*\/>)[^>]*)>([\s\S]*?)<\/c>/g)) {
    const attrs = cellMatch[1];
    const body = cellMatch[2];
    const ref = (attrs.match(/r="([A-Z]+\d+)"/) || [])[1];
    const type = (attrs.match(/\st="([^"]+)"/) || [])[1] || '';
    const valueMatch = body.match(/<v>([\s\S]*?)<\/v>/);
    const inlineMatch = body.match(/<is>([\s\S]*?)<\/is>/);
    let value = '';

    if (!ref) {
      continue;
    }

    if (type === 's' && valueMatch) {
      value = sharedStrings[Number(valueMatch[1])] || '';
    } else if (type === 'inlineStr' && inlineMatch) {
      value = unescapeXml([...inlineMatch[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((textMatch) => textMatch[1]).join(''));
    } else if (valueMatch) {
      value = valueMatch[1];
    }

    cells.set(ref, value);
  }

  return cells;
}

function findUser(users, name) {
  const normalizedName = normalizeText(name);
  const aliases = {
    'melvin e pena': ['melvin pena'],
    'melvin r pena': ['melvin rolando pena'],
  };
  const candidates = [normalizedName, ...(aliases[normalizedName] || [])];

  return users.find((user) => {
    const normalizedUser = normalizeText(user.nombre || user.name || user.usuario);
    return candidates.some((candidate) => normalizedUser === candidate || normalizedUser.includes(candidate) || candidate.includes(normalizedUser));
  });
}

function buildWeekRows(sheet, cells, users) {
  const weekNumber = sheetWeekNumber(sheet.name);
  const startDate = weekStartDate(weekNumber);
  const rows = [];
  const summary = [];

  for (const rowNumber of employeeRows) {
    const employeeName = String(cells.get(`A${rowNumber}`) || '').trim();

    if (!employeeName) {
      continue;
    }

    const user = findUser(users, employeeName);
    const totalHours = cellNumber(cells.get(`AL${rowNumber}`));
    const salary = cellNumber(cells.get(`AM${rowNumber}`));
    const bonus = cellNumber(cells.get(`AN${rowNumber}`));
    const total = cellNumber(cells.get(`AO${rowNumber}`));

    summary.push({ employeeName, userId: user?.id || null, totalHours, salary, bonus, total });

    if (!user) {
      continue;
    }

    const normalPay = cellNumber(cells.get(`AE${rowNumber}`));
    const extra1Pay = cellNumber(cells.get(`AG${rowNumber}`));
    const extra2Pay = cellNumber(cells.get(`AI${rowNumber}`));
    const extra3Pay = cellNumber(cells.get(`AK${rowNumber}`));

    for (const [index, day] of dayGroups.entries()) {
      const dayDate = new Date(startDate);
      dayDate.setUTCDate(startDate.getUTCDate() + index);
      rows.push({
        userId: user.id,
        day: `${day.name} ${formatDate(dayDate)}`,
        normalHours: cellNumber(cells.get(`${day.normal}${rowNumber}`)),
        extra1Hours: cellNumber(cells.get(`${day.extra1}${rowNumber}`)),
        extra2Hours: cellNumber(cells.get(`${day.extra2}${rowNumber}`)),
        extra3Hours: cellNumber(cells.get(`${day.extra3}${rowNumber}`)),
        normalPay,
        extra1Pay,
        extra2Pay,
        extra3Pay,
        totalHours,
        salary,
        bonus,
        total,
      });
    }
  }

  return { weekNumber, rows, summary };
}

async function main() {
  const users = await listAttendanceUsers();
  const workbook = parseWorkbook();
  const weeks = workbook.sheets.map((sheet) => {
    const cells = parseSheetCells(sheet.path, workbook.sharedStrings);
    return {
      sheetName: sheet.name,
      ...buildWeekRows(sheet, cells, users),
    };
  });

  console.table(
    weeks.map((week) => ({
      hoja: week.sheetName,
      semana: week.weekNumber,
      renglones: week.rows.length,
      total: week.summary.reduce((total, row) => total + row.total, 0),
    })),
  );

  if (dryRun) {
    return;
  }

  for (const week of weeks) {
    const weekTotal = week.summary.reduce((total, row) => total + row.total, 0);

    if (week.rows.length === 0 || weekTotal === 0) {
      continue;
    }

    const result = await savePayrollWeek({
      weekNumber: week.weekNumber,
      createdByUserId: 1,
      rows: week.rows,
    });
    console.log(`Semana ${week.weekNumber}: ${result.inserted} renglones registrados.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
