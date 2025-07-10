const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_XTh9cHtDb3Qw@ep-black-boat-ae7gdwrm-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  max: 20,
  min: 2,
  idle: 10000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000,
  ssl: {
    rejectUnauthorized: false
  }
});

// Retry mechanism for database operations
async function retryTransaction(operation, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      console.log(`Attempt ${i + 1} failed:`, error.message);
      if (error.code === '40P01' && i < maxRetries - 1) { // Deadlock
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
        continue;
      }
      throw error;
    }
  }
}

// Test database connection
async function testConnection() {
  console.log('🔗 Testing database connection...');
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT version(), current_database(), current_user');
    console.log('✅ Connection successful!');
    console.log('Database:', result.rows[0].current_database);
    console.log('User:', result.rows[0].current_user);
    console.log('Version:', result.rows[0].version.split(',')[0]);
    client.release();
    return true;
  } catch (error) {
    console.log('❌ Connection failed:', error.message);
    console.log('Error code:', error.code);
    return false;
  }
}

// Test reading data
async function testReading() {
  console.log('\n📖 Testing data reading operations...');
  
  try {
    // Test reading existing tables
    console.log('Reading table list...');
    const tablesResult = await pool.query(`
      SELECT table_name, table_schema 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('✅ Found tables:', tablesResult.rows.map(r => r.table_name));

    // Test reading users table
    console.log('Reading users table...');
    const usersResult = await pool.query('SELECT COUNT(*) as user_count FROM users');
    console.log('✅ Users count:', usersResult.rows[0].user_count);

    // Test reading with limit
    console.log('Reading limited user data...');
    const limitedResult = await pool.query('SELECT id, email FROM users LIMIT 5');
    console.log('✅ Sample users:', limitedResult.rows);

    return true;
  } catch (error) {
    console.log('❌ Reading failed:', error.message);
    console.log('Error code:', error.code);
    
    // Handle specific reading errors
    if (error.code === '42P01') {
      console.log('💡 Solution: Table does not exist. Check table name or create the table.');
    } else if (error.code === '42703') {
      console.log('💡 Solution: Column does not exist. Check column name or table structure.');
    }
    
    return false;
  }
}

// Test writing data
async function testWriting() {
  console.log('\n✏️ Testing data writing operations...');
  
  try {
    const client = await pool.connect();
    
    try {
      // Start transaction
      await client.query('BEGIN');
      
      // Test INSERT with conflict handling
      console.log('Testing INSERT with conflict handling...');
      const testEmail = `test_${Date.now()}@example.com`;
      const insertResult = await client.query(`
        INSERT INTO users (email, password_hash, first_name, created_at) 
        VALUES ($1, $2, $3, NOW()) 
        ON CONFLICT (email) DO NOTHING 
        RETURNING id, email, first_name
      `, [testEmail, 'hashed_password_123', 'Test User']);
      
      if (insertResult.rows.length > 0) {
        console.log('✅ Insert successful:', insertResult.rows[0]);
        const userId = insertResult.rows[0].id;
        
        // Test UPDATE
        console.log('Testing UPDATE operation...');
        const updateResult = await client.query(`
          UPDATE users 
          SET first_name = $2, updated_at = NOW() 
          WHERE id = $1 
          RETURNING id, email, first_name, updated_at
        `, [userId, 'Updated User']);
        console.log('✅ Update successful:', updateResult.rows[0]);
        
        // Test DELETE
        console.log('Testing DELETE operation...');
        const deleteResult = await client.query(`
          DELETE FROM users 
          WHERE id = $1 
          RETURNING id, email
        `, [userId]);
        console.log('✅ Delete successful:', deleteResult.rows[0]);
      } else {
        console.log('ℹ️ Insert skipped (duplicate email)');
      }
      
      // Commit transaction
      await client.query('COMMIT');
      console.log('✅ Transaction committed successfully');
      
      return true;
    } catch (error) {
      // Rollback on error
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.log('❌ Writing failed:', error.message);
    console.log('Error code:', error.code);
    
    // Handle specific writing errors
    if (error.code === '23505') {
      console.log('💡 Solution: Duplicate key violation. Use ON CONFLICT or check for existing records.');
    } else if (error.code === '23502') {
      console.log('💡 Solution: NOT NULL constraint violation. Provide values for required fields.');
    } else if (error.code === '22001') {
      console.log('💡 Solution: Value too long. Truncate data or increase column size.');
    } else if (error.code === '40P01') {
      console.log('💡 Solution: Deadlock detected. Implement retry logic.');
    }
    
    return false;
  }
}

// Test connection pooling
async function testConnectionPool() {
  console.log('\n🏊 Testing connection pool...');
  
  try {
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        pool.query('SELECT $1 as connection_test, pg_backend_pid() as pid', [i])
      );
    }
    
    const results = await Promise.all(promises);
    console.log('✅ Pool test successful. Backend PIDs:', 
      results.map(r => r.rows[0].pid).join(', '));
    
    // Check pool status
    console.log('Pool status:');
    console.log('- Total connections:', pool.totalCount);
    console.log('- Idle connections:', pool.idleCount);
    console.log('- Waiting count:', pool.waitingCount);
    
    return true;
  } catch (error) {
    console.log('❌ Pool test failed:', error.message);
    return false;
  }
}

// Test error scenarios
async function testErrorScenarios() {
  console.log('\n🚨 Testing error scenarios...');
  
  let errorsCaught = 0;
  
  // Test 1: Invalid table name
  try {
    await pool.query('SELECT * FROM non_existent_table');
  } catch (error) {
    console.log('✅ Caught expected error - Invalid table:', error.code);
    errorsCaught++;
  }
  
  // Test 2: Invalid column name
  try {
    await pool.query('SELECT non_existent_column FROM users');
  } catch (error) {
    console.log('✅ Caught expected error - Invalid column:', error.code);
    errorsCaught++;
  }
  
  // Test 3: Syntax error
  try {
    await pool.query('INVALID SQL SYNTAX');
  } catch (error) {
    console.log('✅ Caught expected error - Syntax error:', error.code);
    errorsCaught++;
  }
  
  // Test 4: Constraint violation (duplicate email)
  try {
    await pool.query(`
      INSERT INTO users (email, password_hash) 
      VALUES ('test@cinematch.com', 'password')
    `);
  } catch (error) {
    console.log('✅ Caught expected error - Duplicate key:', error.code);
    errorsCaught++;
  }
  
  console.log(`✅ Error handling tests completed - ${errorsCaught}/4 errors caught`);
  return errorsCaught === 4;
}

// Main test function
async function runDatabaseTests() {
  console.log('🚀 Starting comprehensive database tests...\n');
  
  const tests = [
    { name: 'Connection Test', fn: testConnection },
    { name: 'Reading Test', fn: testReading },
    { name: 'Writing Test', fn: testWriting },
    { name: 'Connection Pool Test', fn: testConnectionPool },
    { name: 'Error Scenarios Test', fn: testErrorScenarios }
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      const success = await test.fn();
      results.push({ name: test.name, success });
    } catch (error) {
      console.log(`❌ ${test.name} failed with unexpected error:`, error.message);
      results.push({ name: test.name, success: false });
    }
  }
  
  // Summary
  console.log('\n📊 Test Results Summary:');
  console.log('=' + '='.repeat(40));
  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.name}`);
  });
  
  const passCount = results.filter(r => r.success).length;
  console.log(`\nTotal: ${passCount}/${results.length} tests passed`);
  
  await pool.end();
  console.log('\n🏁 Database tests completed!');
}

// Export for use in other modules
module.exports = {
  pool,
  retryTransaction,
  testConnection,
  testReading,
  testWriting,
  testConnectionPool,
  testErrorScenarios,
  runDatabaseTests
};

// Run tests if this file is executed directly
if (require.main === module) {
  runDatabaseTests().catch(console.error);
}