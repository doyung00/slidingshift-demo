/**
 * 슬라이딩시프트 STT 중간 서버 (Cloudflare Worker) — 리턴제로(RTZR / VITO) STT API 연결
 *
 * 데모 화면(브라우저)  --음성 파일-->  이 서버  --API 키-->  리턴제로
 *                     <--텍스트-----            <--결과----
 *
 * API 키(client_id / client_secret)는 이 서버의 환경 변수에만 저장되고,
 * 공개된 데모 HTML에는 서버 주소만 들어가요.
 *
 * 필요한 환경 변수 (Cloudflare 대시보드 → Worker → Settings → Variables and Secrets)
 *   RTZR_CLIENT_ID      (Secret)  리턴제로 개발자 콘솔에서 발급
 *   RTZR_CLIENT_SECRET  (Secret)  리턴제로 개발자 콘솔에서 발급
 *   ALLOWED_ORIGINS     (Text, 선택) 허용할 데모 주소. 기본값:
 *                        https://doyung00.github.io,null   (null = 내 컴퓨터에서 html 파일을 직접 연 경우)
 */

const API = 'https://openapi.vito.ai/v1';
const MAX_BYTES = 10 * 1024 * 1024; // 10MB (16kHz WAV 기준 약 5분)
const POLL_MS = 1000;
const POLL_MAX = 30; // 최대 약 30초 기다림

let tokenCache = { token: null, exp: 0 };

async function getToken(env) {
  const now = Date.now() / 1000;
  if (tokenCache.token && tokenCache.exp - 300 > now) return tokenCache.token;
  const r = await fetch(`${API}/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.RTZR_CLIENT_ID, client_secret: env.RTZR_CLIENT_SECRET }),
  });
  if (!r.ok) throw new Error(`리턴제로 인증 실패 (${r.status}) · client_id/secret을 확인하세요`);
  const j = await r.json();
  tokenCache = { token: j.access_token, exp: j.expire_at || now + 6 * 3600 };
  return j.access_token;
}

function cors(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || 'https://doyung00.github.io,null').split(',').map((s) => s.trim());
  const ok = allowed.includes('*') || allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin || '*' : allowed[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const json = (body, status, headers) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const h = cors(origin, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });

    // 연결 확인용 (데모의 「연결 확인」 버튼)
    if (req.method === 'GET') {
      const ready = !!(env.RTZR_CLIENT_ID && env.RTZR_CLIENT_SECRET);
      return json({ ok: ready, provider: '리턴제로', model: 'sommers', error: ready ? undefined : 'RTZR_CLIENT_ID / RTZR_CLIENT_SECRET 환경 변수가 없어요' }, 200, h);
    }
    if (req.method !== 'POST') return json({ error: 'POST로 음성 파일을 보내 주세요' }, 405, h);

    if (origin && h['Access-Control-Allow-Origin'] !== origin) return json({ error: '허용되지 않은 주소에서 온 요청이에요' }, 403, h);
    if (!env.RTZR_CLIENT_ID || !env.RTZR_CLIENT_SECRET) return json({ error: '서버에 리턴제로 키가 설정되지 않았어요' }, 500, h);

    try {
      const form = await req.formData();
      const file = form.get('file');
      if (!file || typeof file === 'string') return json({ error: 'file 필드에 음성 파일이 없어요' }, 400, h);
      if (file.size > MAX_BYTES) return json({ error: '파일이 너무 커요 (최대 10MB)' }, 413, h);

      const token = await getToken(env);

      // 1) 변환 요청
      const up = new FormData();
      up.append('file', file, file.name || 'record.wav');
      up.append('config', JSON.stringify({
        use_diarization: false,
        use_itn: true,              // 숫자·단위를 "두 팩" → "2팩"처럼 정리
        use_disfluency_filter: true, // "어, 음" 같은 말 더듬 제거
        use_profanity_filter: false,
        use_paragraph_splitter: false,
      }));
      const r1 = await fetch(`${API}/transcribe`, { method: 'POST', headers: { Authorization: `bearer ${token}` }, body: up });
      const j1 = await r1.json().catch(() => ({}));
      if (!r1.ok || !j1.id) return json({ error: `변환 요청 실패 (${r1.status}) ${j1.msg || j1.code || ''}`.trim() }, 502, h);

      // 2) 결과 조회 (완료될 때까지 1초 간격)
      for (let i = 0; i < POLL_MAX; i++) {
        await new Promise((res) => setTimeout(res, POLL_MS));
        const r2 = await fetch(`${API}/transcribe/${j1.id}`, { headers: { Authorization: `bearer ${token}` } });
        const j2 = await r2.json().catch(() => ({}));
        if (j2.status === 'completed') {
          const text = (j2.results?.utterances || []).map((u) => u.msg).join(' ').trim();
          return json({ text, provider: '리턴제로', id: j1.id }, 200, h);
        }
        if (j2.status === 'failed' || !r2.ok) return json({ error: `변환 실패 ${j2.error?.message || j2.msg || r2.status}` }, 502, h);
      }
      return json({ error: '변환이 30초 안에 끝나지 않았어요. 조금 짧게 말해 주세요' }, 504, h);
    } catch (e) {
      return json({ error: String(e.message || e) }, 500, h);
    }
  },
};
