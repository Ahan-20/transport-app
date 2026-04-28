-- A handful of legacy monthly_payments rows store paid_on in YYYY-MMM-DD
-- format ("2026-MAY-01") instead of ISO YYYY-MM-DD. Lexicographic sorting
-- puts those rows above genuinely newer ISO-format dates, which makes the
-- /history page show them first by mistake. Normalize them to ISO so the
-- sort is correct and the formatter doesn't have to handle two formats.
UPDATE monthly_payments
   SET paid_on = substr(paid_on, 1, 4) || '-' ||
                 CASE substr(paid_on, 6, 3)
                   WHEN 'JAN' THEN '01' WHEN 'FEB' THEN '02' WHEN 'MAR' THEN '03'
                   WHEN 'APR' THEN '04' WHEN 'MAY' THEN '05' WHEN 'JUN' THEN '06'
                   WHEN 'JUL' THEN '07' WHEN 'AUG' THEN '08' WHEN 'SEP' THEN '09'
                   WHEN 'OCT' THEN '10' WHEN 'NOV' THEN '11' WHEN 'DEC' THEN '12'
                 END || '-' || substr(paid_on, 10, 2)
 WHERE paid_on LIKE '____-___-__'
   AND substr(paid_on, 6, 1) >= 'A'
   AND substr(paid_on, 6, 1) <= 'Z';
