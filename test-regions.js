const { GoogleAuth } = require('google-auth-library');

const PROJECT_ID = 'my-openclaw-project-22196';
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

async function testModel(modelId, location) {
  const client = await auth.getClient();
  const token = (await client.getAccessToken()).token;
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${location}/publishers/google/models/${modelId}:generateContent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'hi' }] }] })
  });

  if (res.ok) {
    console.log(`✅ ${modelId} in ${location} works!`);
  } else {
    console.log(`❌ ${modelId} in ${location} failed: ${res.status}`);
  }
}

async function run() {
  await testModel('gemini-1.5-flash-001', 'us-east4');
  await testModel('gemini-1.5-flash-001', 'us-west1');
  await testModel('gemini-1.5-flash-001', 'us-central1');
  await testModel('gemini-1.0-pro-001', 'us-central1');
}
run();
