const { GoogleAuth } = require('google-auth-library');

const PROJECT_ID = 'my-openclaw-project-22196';
const LOCATION = 'us-central1';
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

async function testModel(modelId, version='v1') {
  const client = await auth.getClient();
  const token = (await client.getAccessToken()).token;
  const url = `https://${LOCATION}-aiplatform.googleapis.com/${version}/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${modelId}:generateContent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'hi' }] }] })
  });

  if (res.ok) {
    console.log(`✅ ${modelId} (${version}) works!`);
  } else {
    console.log(`❌ ${modelId} (${version}) failed: ${res.status}`);
  }
}

async function run() {
  await testModel('gemini-1.5-flash-001', 'v1');
  await testModel('gemini-1.5-flash-001', 'v1beta1');
  await testModel('gemini-pro', 'v1');
  await testModel('gemini-1.0-pro-001', 'v1');
  await testModel('gemini-1.5-pro-001', 'v1beta1');
  await testModel('gemini-1.5-flash-preview-0514', 'v1beta1');
}
run();
