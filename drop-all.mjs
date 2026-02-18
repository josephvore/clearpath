import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  
  // Keep querying until no tables remain
  let maxIter = 5;
  while (maxIter-- > 0) {
    const [rows] = await conn.query('SHOW TABLES');
    if (rows.length === 0) break;
    const dbName = Object.keys(rows[0])[0];
    for (const row of rows) {
      const tableName = row[dbName];
      console.log(`Dropping table: ${tableName}`);
      await conn.query(`DROP TABLE IF EXISTS \`${tableName}\``);
    }
  }
  
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  
  // Verify
  const [remaining] = await conn.query('SHOW TABLES');
  console.log(`Tables remaining: ${remaining.length}`);
  
  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
