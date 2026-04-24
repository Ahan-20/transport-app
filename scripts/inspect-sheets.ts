import ExcelJS from "exceljs";

async function listSheets(filePath: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  console.log(`\n===== ${filePath} =====`);
  const sheets: string[] = [];
  wb.eachSheet((ws) => sheets.push(`"${ws.name}" (rows: ${ws.rowCount}, cols: ${ws.columnCount})`));
  for (const s of sheets) console.log(s);
}

(async () => {
  for (const f of process.argv.slice(2)) await listSheets(f);
})();
