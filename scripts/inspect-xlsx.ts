import ExcelJS from "exceljs";

async function inspect(filePath: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  console.log(`\n========== ${filePath} ==========`);
  wb.eachSheet((ws) => {
    console.log(`\n--- Sheet: "${ws.name}" (rows: ${ws.rowCount}, cols: ${ws.columnCount})`);
    for (let r = 1; r <= Math.min(5, ws.rowCount); r++) {
      const row = ws.getRow(r);
      const cells: string[] = [];
      for (let c = 1; c <= Math.min(30, ws.columnCount); c++) {
        const v = row.getCell(c).value;
        cells.push(v === null || v === undefined ? "" : String(typeof v === "object" && v !== null && "richText" in v ? (v as any).richText.map((t: any) => t.text).join("") : v).slice(0, 40));
      }
      console.log(`  R${r}: ${cells.map((c, i) => `[${i + 1}:${c}]`).join(" ")}`);
    }
  });
}

(async () => {
  await inspect(process.argv[2]);
})();
