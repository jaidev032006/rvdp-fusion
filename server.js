// RVDP-FUSION backend: serves the simulator and sends the ambulance SMS through Twilio.
// ZERO dependencies: only Node.js 18+ is needed (no npm install).
// Twilio keys are read from .env and never sent to the browser.
const http = require('http');
const fs = require('fs');
const path = require('path');

process.on('uncaughtException', err => {
  console.error('[UNCAUGHT EXCEPTION]', err.message || err);
});
process.on('unhandledRejection', reason => {
  console.error('[UNHANDLED REJECTION]', reason && reason.message ? reason.message : reason);
});

/* ---------- tiny .env loader ---------- */
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach(l => {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !l.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (e) { console.error('No .env file found. Copy .env.example to .env and fill it in.'); }

const E = process.env;
const SID = E.TWILIO_ACCOUNT_SID, TOKEN = E.TWILIO_AUTH_TOKEN;
const FROM = E.TWILIO_FROM, MSID = E.TWILIO_MESSAGING_SERVICE_SID, FLOW = E.TWILIO_FLOW_SID;
const MODE = (E.SEND_MODE || 'sms').toLowerCase();            // sms | flow | both
const PORT = +E.PORT || 3000, GAP = (+E.MIN_GAP_SECONDS || 15) * 1000;
let ALLOWED = (E.ALLOWED_TO || '').split(',').map(x => x.trim()).filter(Boolean);
if (!SID || !TOKEN || (!FROM && !MSID)) console.error('WARNING: Twilio settings missing in .env, SMS will fail.');

const AUTH = 'Basic ' + Buffer.from(`${SID}:${TOKEN}`).toString('base64');
async function twilioPost(url, fields) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: AUTH, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString()
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.message || ('Twilio HTTP ' + r.status));
  return j;
}

const PUB = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
let lastSms = 0, lastCall = 0;

function escapeXml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}

async function twilioGet(url) {
  const r = await fetch(url, {
    method: 'GET',
    headers: { Authorization: AUTH }
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.message || ('Twilio HTTP ' + r.status));
  return j;
}

let callSession = {
  active: false,
  attended: false,
  to: '',
  message: '',
  reason: '',
  bus: '',
  route: '',
  currentSid: null,
  callStatus: 'idle', // 'idle' | 'calling' | 'in-progress' | 'attended' | 'waiting-retry' | 'stopped'
  retryCount: 0,
  nextRetryTime: 0,
  timer: null,
  pollTimer: null
};

function stopCallSession(reason) {
  if (callSession.timer) { clearTimeout(callSession.timer); callSession.timer = null; }
  if (callSession.pollTimer) { clearInterval(callSession.pollTimer); callSession.pollTimer = null; }
  callSession.active = false;
  if (reason) callSession.callStatus = reason;
  if (reason !== 'attended') {
    callSession.attended = false;
  }
  console.log(new Date().toLocaleTimeString(), `Call session status: ${callSession.callStatus}`);
}

async function checkCallStatus(sid) {
  if (!sid) return;
  try {
    const data = await twilioGet(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Calls/${sid}.json`);
    const status = data.status; // queued, ringing, in-progress, completed, busy, no-answer, canceled, failed
    const duration = +(data.duration || 0);

    // If call was attended (picked up / answered)
    if (status === 'in-progress' || (status === 'completed' && duration > 0)) {
      callSession.attended = true;
      callSession.callStatus = 'attended';
      stopCallSession('attended');
      console.log(new Date().toLocaleTimeString(), `[SUCCESS] CALL ATTENDED by receiver! (duration: ${duration}s). Emergency calling STOPPED.`);
      return;
    }

    // If call ended without being attended (unanswered, busy, rejected)
    if (['no-answer', 'busy', 'failed', 'canceled'].includes(status) || (status === 'completed' && duration === 0)) {
      if (callSession.pollTimer) { clearInterval(callSession.pollTimer); callSession.pollTimer = null; }
      if (!callSession.active || callSession.attended) return;

      callSession.callStatus = 'waiting-retry';
      callSession.retryCount++;
      callSession.nextRetryTime = Date.now() + 60000; // Retry in 1 minute (60s)
      console.log(new Date().toLocaleTimeString(), `[ALERT] Call was NOT ATTENDED (${status}). Next retry scheduled in 60s (Attempt #${callSession.retryCount + 1})...`);

      callSession.timer = setTimeout(() => {
        if (callSession.active && !callSession.attended) {
          triggerCallAttempt();
        }
      }, 60000);
    }
  } catch (err) {
    console.error('Error polling Twilio call status:', err.message);
  }
}

function sanitizeForTwilioSay(str) {
  if (!str) return '';
  let s = str;
  // If string contains Tamil Unicode characters (\u0B80-\u0BFF), map known phrases to Tanglish
  if (/[\u0B80-\u0BFF]/.test(s)) {
    s = s
      .replace(/ஆர்பிவிடிபி/g, 'RVDP')
      .replace(/பேருந்து/g, 'Bus')
      .replace(/பாதுகாப்பு/g, 'pathukaappu')
      .replace(/அவசர/g, 'avasara')
      .replace(/எச்சரிக்கை/g, 'echcharikkai')
      .replace(/பயணிக்கு/g, 'passengerukku')
      .replace(/மருத்துவ/g, 'maruthuva')
      .replace(/உதவி/g, 'udhavi')
      .replace(/தேவைப்படுகிறது/g, 'thevaipadugiradhu')
      .replace(/உடனடியாக/g, 'udanadiyaga')
      .replace(/ஆம்புலன்ஸ்/g, 'ambulance')
      .replace(/அனுப்பவும்/g, 'anuppavum')
      .replace(/வணக்கம்/g, 'Vanakkam')
      .replace(/சோதனை/g, 'test')
      .replace(/அழைப்பு/g, 'call')
      .replace(/சரியாக/g, 'seriyaaga')
      .replace(/செயல்படுகிறது/g, 'velai seigiradhu')
      .replace(/நடத்துநர்/g, 'conductor')
      .replace(/வந்துவிட்டது/g, 'vandhuvittadhu')
      .replace(/உறுதிப்படுத்தியுள்ளார்/g, 'urudhi seithullaar')
      .replace(/மீண்டும்/g, 'marubadiyum')
      .replace(/சொல்கிறேன்/g, 'solgiren');
    s = s.replace(/[\u0B80-\u0BFF]/g, ' ');
  }
  // Strip emojis and non-speech symbols
  s = s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ');
  // Strip markdown asterisks and formatting symbols
  s = s.replace(/\*+/g, '');
  s = s.replace(/[—–]/g, ', ');
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) s = 'Avasaram! Avasaram! Bus TN 47 N 0001 passenger medical emergency. Udaney ambulance thevai.';
  return s;
}

function getVoiceConfig(lang) {
  // Twilio <Say> does NOT support 'ta-IN'. Using en-IN with Polly.Aditi cleanly speaks Tanglish and English with Indian accent.
  if (lang === 'en-US') {
    return { language: 'en-US', voice: 'alice', isIndian: false };
  }
  return { language: 'en-IN', voice: 'Polly.Aditi', isIndian: true };
}

async function triggerCallAttempt() {
  if (!callSession.active || callSession.attended) return;
  if (!FROM) {
    console.error('TWILIO_FROM missing');
    return;
  }
  const vc = getVoiceConfig(callSession.language);
  const bus = callSession.bus || 'TN 47 N 0001';
  const route = callSession.route || '48C';
  const defaultMsg = callSession.reason === 'ambulance_reached'
    ? (vc.isIndian
        ? `RVDP bus thagaval. Bus ${bus} ambulance vandhuvittadhu endru conductor urudhi seithullaar. Emergency situation cleared.`
        : `Update from RVDP bus safety system. Conductor has confirmed that the ambulance has reached bus ${bus}. Emergency situation cleared.`)
    : (callSession.reason === 'accident'
        ? (vc.isIndian
            ? `Avasaram! Avasaram! Severe Road Accident Emergency alert, Tamil Nadu Government Bus. Bus Number: ${bus}. Indha bus collision accident-la sikkivittadhu. Palaveyru passengers kaayamadaithullaargal. Udanadiyaaga multiple ambulances thevai! Dayavu seidhu udanadiyaaga ambulance medical team-ai sambava idathukku anuppi vaikkavum. Idhu migavum avasara nilai. Thayavu seidhu thaamadhikkaamal nadavadikkai edukkavum! RVDP-FUSION Intelligent Bus Safety System.`
            : `Severe road accident emergency alert from RVDP bus safety system. High-impact collision reported on bus ${bus}, route ${route}. Multiple casualties detected. Immediate multi-ambulance emergency response required.`)
        : (vc.isIndian
            ? `Avasaram! Avasaram! Emergency alert, Tamil Nadu Government Bus. Bus Number: ${bus}. Indha bus-la oru passenger-ku medical emergency yerpattulladhu. Udanadiyaaga ambulance thevai! Dayavu seidhu udanadiyaaga ambulance-ai anuppi vaikkavum. Passenger-in uyirukku aabathu irukkalaam. Adhanaal medical team viraivaaga sambava idathukku vandhu sera vendum. Arugil irukkum hospital matrum emergency response team-ku indha thagavalai udanadiyaaga therivikkavum. Idhu oru avasara nilai. Thayavu seidhu thaamadhikkaamal nadavadikkai edukkavum! RVDP-FUSION Bus Safety Alert System.`
            : `Critical emergency alert from RVDP bus safety system. Passenger medical emergency confirmed on bus ${bus}, route ${route}. Immediate ambulance dispatch required.`));
  const rawText = callSession.message || defaultMsg;
  const sayText = sanitizeForTwilioSay(rawText);
  const repeatPrefix = vc.isIndian ? 'Marubadiyum solgiren: ' : 'Repeating: ';
  const twiml = `<Response><Pause length="1"/><Say language="${vc.language}" voice="${vc.voice}">${escapeXml(sayText)}</Say><Pause length="1"/><Say language="${vc.language}" voice="${vc.voice}">${repeatPrefix}${escapeXml(sayText)}</Say><Pause length="1"/></Response>`;

  try {
    const j = await twilioPost(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Calls.json`, {
      To: callSession.to,
      From: FROM,
      Twiml: twiml
    });
    callSession.currentSid = j.sid;
    callSession.callStatus = 'calling';
    lastCall = Date.now();
    console.log(new Date().toLocaleTimeString(), `Twilio Call attempt #${callSession.retryCount + 1} placed in ${vc.language} (${j.sid}) -> ${callSession.to.slice(0, 4)}****${callSession.to.slice(-3)}`);

    // Poll every 3.5s to detect if receiver answers (attended)
    if (callSession.pollTimer) clearInterval(callSession.pollTimer);
    callSession.pollTimer = setInterval(() => {
      if (callSession.active && !callSession.attended && callSession.currentSid) {
        checkCallStatus(callSession.currentSid);
      } else {
        clearInterval(callSession.pollTimer);
        callSession.pollTimer = null;
      }
    }, 3500);
  } catch (e) {
    console.error('Twilio Call attempt error:', e.message);
    callSession.callStatus = 'waiting-retry';
    callSession.nextRetryTime = Date.now() + 60000;
    callSession.timer = setTimeout(() => {
      if (callSession.active && !callSession.attended) triggerCallAttempt();
    }, 60000);
  }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' });
    return res.end();
  }
  if (req.method === 'GET' && url.pathname === '/api/health') {
    return send(res, 200, {
      ok: true,
      mode: MODE,
      twilio: !!(SID && TOKEN),
      voice: !!(SID && TOKEN && FROM),
      savedNumber: ALLOWED[0] || '+917603854975',
      allowedTo: ALLOWED
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/save-number') {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 10000) req.destroy(); });
    req.on('end', async () => {
      let d; try { d = JSON.parse(raw); } catch { return send(res, 400, { ok: false, error: 'Bad JSON' }); }
      const phone = (d && d.phone ? d.phone.trim() : '');
      if (!/^\+[1-9]\d{7,14}$/.test(phone)) return send(res, 400, { ok: false, error: 'Phone number must look like +917603854975' });
      if (!ALLOWED.includes(phone)) {
        ALLOWED.push(phone);
      }
      try {
        const envPath = path.join(__dirname, '.env');
        let envContent = '';
        try { envContent = fs.readFileSync(envPath, 'utf8'); } catch (e) {}
        if (/^ALLOWED_TO\s*=/m.test(envContent)) {
          envContent = envContent.replace(/^ALLOWED_TO\s*=.*$/m, `ALLOWED_TO=${ALLOWED.join(',')}`);
        } else {
          envContent += `\nALLOWED_TO=${ALLOWED.join(',')}\n`;
        }
        fs.writeFileSync(envPath, envContent, 'utf8');
      } catch (err) {
        console.error('Failed to write .env:', err.message);
      }
      console.log(new Date().toLocaleTimeString(), `[CONFIG] Ambulance phone number saved: ${phone}`);
      return send(res, 200, { ok: true, phone, allowed: ALLOWED });
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/call-status') {
    return send(res, 200, {
      ok: true,
      active: callSession.active,
      attended: callSession.attended,
      status: callSession.callStatus,
      currentSid: callSession.currentSid,
      retryCount: callSession.retryCount,
      nextRetryInSec: callSession.nextRetryTime ? Math.max(0, Math.ceil((callSession.nextRetryTime - Date.now()) / 1000)) : 0
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/stop-call') {
    stopCallSession('stopped');
    return send(res, 200, { ok: true, status: 'stopped', message: 'Call alerts stopped' });
  }

  if (req.method === 'POST' && url.pathname === '/api/make-call') {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 10000) req.destroy(); });
    req.on('end', async () => {
      let d; try { d = JSON.parse(raw); } catch { return send(res, 400, { ok: false, error: 'Bad JSON' }); }
      const { to, message, reason, bus, route, language, voice } = d || {};
      if (!/^\+[1-9]\d{7,14}$/.test(to || '')) return send(res, 400, { ok: false, error: 'Phone number must look like +917603854975' });
      if (ALLOWED.length && !ALLOWED.includes(to)) return send(res, 403, { ok: false, error: 'This number is not in ALLOWED_TO (.env)' });
      if (!FROM) return send(res, 400, { ok: false, error: 'TWILIO_FROM missing in .env for outbound calls' });

      const vc = getVoiceConfig(language || 'en-IN');

      // If test call: one-time direct call
      if (reason === 'test') {
        const defaultTest = vc.isIndian
          ? 'Vanakkam! Idhu RVDP bus safety test call. Voice call integration seriyaaga velai seigiradhu.'
          : 'This is a test voice call from RVDP Bus Safety System.';
        const rawText = message || defaultTest;
        const sayText = sanitizeForTwilioSay(rawText);
        const repeatPrefix = vc.isIndian ? 'Marubadiyum solgiren: ' : 'Repeating: ';
        const twiml = `<Response><Pause length="1"/><Say language="${vc.language}" voice="${vc.voice}">${escapeXml(sayText)}</Say><Pause length="1"/><Say language="${vc.language}" voice="${vc.voice}">${repeatPrefix}${escapeXml(sayText)}</Say><Pause length="1"/></Response>`;
        try {
          const j = await twilioPost(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Calls.json`, { To: to, From: FROM, Twiml: twiml });
          return send(res, 200, { ok: true, sid: j.sid, status: j.status });
        } catch (e) {
          return send(res, 502, { ok: false, error: e.message });
        }
      }

      // If already calling right now within 5 seconds, do not spam
      if (callSession.active && callSession.callStatus === 'calling' && (Date.now() - lastCall < 5000)) {
        return send(res, 200, { ok: true, status: callSession.callStatus, sid: callSession.currentSid, message: 'Call is already placing right now.' });
      }

      // Start new emergency calling session with 1-min retry until attended
      stopCallSession('new_alert');
      callSession.active = true;
      callSession.attended = false;
      callSession.to = to;
      callSession.language = language || 'en-IN';
      callSession.voice = voice || vc.voice;
      callSession.message = message;
      callSession.reason = reason;
      callSession.bus = bus;
      callSession.route = route;
      callSession.retryCount = 0;
      await triggerCallAttempt();
      send(res, 200, { ok: true, status: callSession.callStatus, sid: callSession.currentSid, message: 'Calling initiated in ' + vc.language + '. Will retry 1 call/min until attended.' });
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/send-alert') {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 10000) req.destroy(); });
    req.on('end', async () => {
      let d; try { d = JSON.parse(raw); } catch { return send(res, 400, { ok: false, error: 'Bad JSON' }); }
      const { to, body, lat, lng, acc } = d || {};
      if (!/^\+[1-9]\d{7,14}$/.test(to || '')) return send(res, 400, { ok: false, error: 'Phone number must look like +917603854975' });
      if (ALLOWED.length && !ALLOWED.includes(to)) return send(res, 403, { ok: false, error: 'This number is not in ALLOWED_TO (.env)' });
      if (typeof body !== 'string' || !body.trim()) return send(res, 400, { ok: false, error: 'Empty message' });
      const wait = GAP - (Date.now() - lastSms);
      if (wait > 0) return send(res, 429, { ok: false, error: `Wait ${Math.ceil(wait / 1000)} s before the next SMS` });
      try {
        const out = [];
        if (MODE === 'sms' || MODE === 'both') {
          const f = { To: to, Body: body.slice(0, 600) };
          if (MSID) f.MessagingServiceSid = MSID; else f.From = FROM;
          const j = await twilioPost(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, f);
          out.push({ via: 'sms', sid: j.sid, status: j.status });
        }
        if (MODE === 'flow' || MODE === 'both') {
          if (!FLOW) throw new Error('TWILIO_FLOW_SID missing in .env');
          const params = {
            body: body.slice(0, 600), lat: lat ?? '', lng: lng ?? '',
            accuracy_m: acc != null ? Math.round(acc) : '',
            maps_link: (lat != null && lng != null) ? `https://maps.google.com/?q=${lat},${lng}` : ''
          };
          const j = await twilioPost(`https://studio.twilio.com/v2/Flows/${FLOW}/Executions`, { To: to, From: FROM, Parameters: JSON.stringify(params) });
          out.push({ via: 'flow', sid: j.sid, status: j.status });
        }
        lastSms = Date.now();
        console.log(new Date().toLocaleTimeString(), MODE, out.map(o => o.via + ':' + o.sid).join(' '), '->', to.slice(0, 4) + '****' + to.slice(-3));
        send(res, 200, { ok: true, sid: out[0].sid, status: out[0].via + ' ' + out[0].status });
      } catch (e) {
        console.error('Twilio error:', e.message);
        send(res, 502, { ok: false, error: e.message });
      }
    });
    return;
  }

  /* static files from /public only (so .env is never exposed) */
  let f = url.pathname === '/' ? '/rvdp_fusion_bus_simulator.html' : decodeURIComponent(url.pathname);
  const fp = path.normalize(path.join(PUB, f));
  if (!fp.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(fp, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(fp)] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(PORT, () => console.log(`\nRVDP-FUSION running:  http://localhost:${PORT}\nSend mode: ${MODE}   (Ctrl+C to stop)\n`));
