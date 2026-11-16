# RVDP-FUSION Bus Safety Simulator + Twilio ambulance SMS + live laptop location

## Run (3 steps, no npm install)
1. Install Node.js 18 or newer (https://nodejs.org).
2. Windows: double-click **start.bat**   |   Mac/Linux: run `./start.sh`
   (or in a terminal: `node server.js`)
3. Open **http://localhost:3000** (the script opens it for you).

Do not double-click the html file directly: browser location needs http://localhost.

## Use
Controls tab > "LIVE LOCATION + TWILIO SMS":
- click **Use my laptop location** and press Allow,
- number is pre-filled (+917603854975); tick **Send real SMS through Twilio**,
- press **Send test SMS now**, or run the "Medical button" / "Passenger panic" scenario.

The SMS has: type, bus ID, route, time, live latitude/longitude and a Google Maps link.

## .env settings
- TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM: your Twilio values
- SEND_MODE: `sms` (direct SMS, default) | `flow` (your Studio Flow, location passed as
  {{flow.data.body}}, {{flow.data.maps_link}}, {{flow.data.lat}}, {{flow.data.lng}}, {{flow.data.accuracy_m}}) | `both`
- ALLOWED_TO: only these numbers can receive SMS
- MIN_GAP_SECONDS: minimum gap between two SMS

## Notes
- Laptops have no GPS chip; accuracy comes from Wi-Fi/IP (20 m to a few km).
- Trial Twilio accounts can text only verified numbers. For India numbers check DLT/sender rules if delivery fails (Twilio Console > Monitor > Logs).
- The .env file holds your secret token. Do not share this folder or upload it to GitHub. Rotate the token after testing.
