// Test MCP API endpoints
async function test() {
  // Test status
  let res = await fetch('http://localhost:3000/api/mcp/status');
  let data = await res.json();
  console.log('=== STATUS ===');
  console.log(JSON.stringify(data, null, 2));

  // Test config
  res = await fetch('http://localhost:3000/api/mcp/config/claude-desktop');
  data = await res.json();
  console.log('\n=== CLAUDE DESKTOP CONFIG ===');
  console.log(JSON.stringify(data, null, 2));

  // Test log
  res = await fetch('http://localhost:3000/api/mcp/log');
  data = await res.json();
  console.log('\n=== LOG ===');
  console.log(`${data.log.length} entries`);
}
test();
