# 리턴제로 STT 연결 방법

데모의 음성 기록을 **리턴제로(VITO) STT API**로 실제 변환하는 방법이에요.

```
데모 화면 ──녹음 파일(WAV)──▶ 중간 서버 (Cloudflare Worker) ──API 키──▶ 리턴제로
         ◀──────텍스트──────                                ◀──결과──
```

API 키를 데모 HTML에 넣으면 공개 저장소라서 누구나 볼 수 있어요. 그래서 키는 중간 서버에만 넣고, 데모에는 서버 주소만 넣어요.

## 1. 리턴제로 키 발급 (약 5분)

1. https://developers.rtzr.ai 에 가입하고 로그인
2. 콘솔에서 애플리케이션을 등록하면 **client_id**와 **client_secret**이 나와요
3. 두 값을 메모장에 복사해 두세요 (다른 사람에게 공유하지 않기)

## 2. 중간 서버 만들기 (Cloudflare Workers, 무료, 약 5분)

1. https://dash.cloudflare.com 가입 → 왼쪽 메뉴 **Workers & Pages** → **Create** → **Create Worker**
2. 이름을 `slidingshift-stt`로 정하고 **Deploy**
3. **Edit code**를 누르고, 기존 코드를 모두 지운 뒤 이 폴더의 [`worker.js`](./worker.js) 내용을 통째로 붙여 넣고 **Deploy**
4. Worker 화면 → **Settings** → **Variables and Secrets** → **Add**
   - `RTZR_CLIENT_ID` · 종류 **Secret** · 값: 1에서 받은 client_id
   - `RTZR_CLIENT_SECRET` · 종류 **Secret** · 값: 1에서 받은 client_secret
   - (선택) `ALLOWED_ORIGINS` · 종류 Text · 기본값은 `https://doyung00.github.io,null`
     (`null`은 내 컴퓨터에서 html 파일을 직접 연 경우예요. 다른 주소에 올리면 그 주소를 쉼표로 추가)
5. 위쪽에 나오는 주소(예: `https://slidingshift-stt.내이름.workers.dev`)를 복사

브라우저 주소창에 그 주소를 열었을 때 `{"ok":true,"provider":"리턴제로",...}`가 나오면 준비 끝이에요.

## 3. 데모에 서버 주소 넣기

방법 A — 내 브라우저에서만 쓰기 (가장 간단)
- 데모 → 음성으로 기록 → 아래 **⚙️ STT 서버 설정** → 주소 붙여 넣고 저장 → **🔌 연결 확인**

방법 B — 링크로 바로 쓰기
- `https://doyung00.github.io/slidingshift-demo/?stt=서버주소` 로 열면 자동 저장돼요

방법 C — 모든 사람에게 기본값으로
- `index.html`에서 `const STT_DEFAULT_URL='';` 따옴표 안에 서버 주소를 넣고 커밋

## 4. 사용

음성으로 기록 화면에서 **🎧 외부 STT API로 실제 녹음** → 말하기 → **녹음 끝내고 AI로 정리하기**
→ 리턴제로가 글자로 바꾼 문장으로 AI 카드가 만들어져요 (카드의 원본 기록에 「리턴제로 변환」 표시).

- 한 번에 최대 60초까지 녹음돼요. 변환은 보통 몇 초 걸려요.
- 발표 녹화처럼 안정성이 중요할 땐 기존 **기본 시나리오**(녹음 끝내기 버튼)를 쓰는 게 안전해요.

## 주의

- 서버 주소를 아는 사람은 누구나 변환 요청을 보낼 수 있어요. 무료 크레딧을 넘기면 요금이 나올 수 있으니, 발표가 끝나면 Worker를 지우거나 리턴제로 콘솔에서 키를 삭제하세요.
- 키를 채팅·카톡·깃허브에 올리지 마세요. 실수로 올렸다면 콘솔에서 바로 재발급하세요.
