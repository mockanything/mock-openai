import http from 'node:http';

const HOST = process.env.HOST || 'localhost';
const PORT = process.env.PORT || '3000';
const CONNECTIONS = parseInt(process.env.CONNECTIONS || '50', 10);
const DURATION = parseInt(process.env.DURATION || '30', 10);
const BODY = JSON.stringify({
  model: 'apple-v1-flash',
  messages: [{ role: 'user', content: 'hello' }],
});

function agent() {
  return new http.Agent({ keepAlive: true, maxSockets: CONNECTIONS });
}

function run(label, body, cb) {
  console.log(`\n  ── ${label} ──\n`);
  const start = Date.now();
  let completed = 0;
  let errors = 0;
  const latencies = [];
  const a = agent();

  function req() {
    const t0 = Date.now();
    const opts = {
      hostname: HOST, port: PORT, path: '/v1/chat/completions',
      method: 'POST', agent: a,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    const r = http.request(opts, (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        if (res.statusCode === 200) { completed++; latencies.push(Date.now() - t0); }
        else errors++;
        if (Date.now() - start < DURATION * 1000) setImmediate(req);
      });
    });
    r.on('error', () => { errors++; if (Date.now() - start < DURATION * 1000) setImmediate(req); });
    r.write(body); r.end();
  }

  for (let i = 0; i < CONNECTIONS; i++) req();

  setTimeout(() => {
    const elapsed = (Date.now() - start) / 1000;
    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
    const avg = latencies.length ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1) : 0;
    a.destroy();
    cb({ elapsed, completed, errors, rps: (completed / elapsed).toFixed(1), avgLatency: avg, p50, p99 });
  }, DURATION * 1000 + 5000);
}

console.log(`Benchmark: ${CONNECTIONS} connections × ${DURATION}s\n`);

run('Non-streaming  POST /v1/chat/completions  (stream:false)', BODY, (ns) => {
  run('Streaming      POST /v1/chat/completions  (stream:true)', JSON.stringify({ ...JSON.parse(BODY), stream: true }), (st) => {
    const bar = '─'.repeat(60);
    console.log(`\n  ${bar}`);
    console.log(`  ${'Mode'.padEnd(14)} ${'Req/Sec'.padEnd(10)} ${'Total'.padEnd(8)} ${'Avg(ms)'.padEnd(10)} ${'P50(ms)'.padEnd(10)} ${'P99(ms)'.padEnd(10)} Errors`);
    console.log(`  ${bar}`);
    console.log(`  ${'Non-streaming'.padEnd(14)} ${ns.rps.padEnd(10)} ${ns.completed.toString().padEnd(8)} ${ns.avgLatency.padEnd(10)} ${ns.p50.toString().padEnd(10)} ${ns.p99.toString().padEnd(10)} ${ns.errors}`);
    console.log(`  ${'Streaming'.padEnd(14)} ${st.rps.padEnd(10)} ${st.completed.toString().padEnd(8)} ${st.avgLatency.padEnd(10)} ${st.p50.toString().padEnd(10)} ${st.p99.toString().padEnd(10)} ${st.errors}`);
    console.log(`  ${bar}\n`);
    process.exit(0);
  });
});
