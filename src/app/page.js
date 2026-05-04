'use client'

import { useState, useRef, useEffect } from 'react'

const PHASES = [
  { value: 'initial', label: '初回提案' },
  { value: 'objection', label: '切り返し' },
  { value: 'interview_prep', label: '面接対策' },
  { value: 'test_closing', label: 'テストクロージング' },
  { value: 'closing', label: 'クロージング' },
]

const OBJECTION_TYPES = [
  '年収が下がる',
  '会社の知名度が低い',
  '職種が変わる',
  '残業が多そう',
  '転職のタイミングではない',
  '内定後の辞退リスク',
]

const CANDIDATE_TYPES = [
  {
    value: 'condition',
    label: '条件重視型',
    emoji: '💰',
    desc: '年収・残業・休日の数字で動く',
    tone: `・年収差・残業時間の差・休日数など、具体的な数字を前面に出す
・「現職と比べて〜万円アップ」「残業が月〜時間減る」という比較構文を使う
・感情的な表現より「条件面で明確にメリットがある」という事実ベースで話す
・曖昧な表現を避け、数字で語れないことは言わない`,
  },
  {
    value: 'career',
    label: 'キャリア重視型',
    emoji: '📈',
    desc: '成長・スキルアップ・将来性で動く',
    tone: `・「この求人で〜のキャリアが開ける」という未来志向のトーンで話す
・今の会社にいると何を失うか（機会損失）を具体的に語る
・資格取得支援・昇格スピード・裁量の大きさを積極的に出す
・「今動くことで〜年後に差が出る」という時間軸のある語りかけをする`,
  },
  {
    value: 'environment',
    label: '環境重視型',
    emoji: '🤝',
    desc: '職場の人・雰囲気・安定感で動く',
    tone: `・職場の雰囲気・チームの人柄・会社の安定感を具体的に伝える
・「長く働ける環境かどうか」という視点で求人を語る
・数字より「どんな人たちと働くか」「どんな会社文化か」のイメージを語る
・転職リスクより「今の環境を変えることで得られる安心感」を伝える`,
  },
  {
    value: 'push',
    label: '背中押し型',
    emoji: '🚪',
    desc: '動きたいが踏み出せない、一押しが必要',
    tone: `・「まず話を聞くだけでOK」「比較のために見ておくだけでいい」と心理的ハードルを徹底的に下げる
・「今のままでいいのか」という現状維持のリスクをやんわり伝える
・決断を急かさず「一緒に考えましょう」のスタンスを保ちながら次の一歩を促す
・「動いた人がどうなったか」という他の求職者の事例イメージを匂わせる`,
  },
]

const OTHER_PROCESS_OPTIONS = [
  { value: 'none', label: 'なし', emoji: '—', desc: '他に進んでいる選考はない' },
  { value: 'ongoing', label: '選考中', emoji: '⚡', desc: '他社の選考が並行して進んでいる' },
  { value: 'final', label: '最終・内定近い', emoji: '🔥', desc: '他社で最終面接 or 内定が出そう' },
]

const SUMMARY_PROMPTS = {
  candidate: `あなたは転職エージェントのCAです。
以下は求職者に関する情報です。CAが提案スクリプトを作成するために必要な情報を抽出し、以下の形式で簡潔にまとめてください。

【出力形式】
・転職理由：（現職への不満・不安・きっかけを1〜2文で）
・現在の状況：（職種／年収／勤続年数／資格など）
・将来の希望：（どんな働き方・環境・キャリアを求めているか）
・懸念・こだわり：（年収条件・勤務地・業界など外せない条件があれば）

情報がない項目は「不明」と記載。冗長な説明は不要。`,

  job: `あなたは転職エージェントのCAです。
以下は求人票または企業情報です。CAが提案スクリプトを作成するために必要な情報を抽出し、以下の形式で簡潔にまとめてください。

【出力形式】
・職種・業務内容：（一言で）
・年収・待遇：（想定年収／残業時間／休日など）
・職場環境：（規模感・雰囲気・転勤有無など）
・キャリアパス：（将来的にどんなポジションに進めるか）
・この求人の一番の強み：（他社と比べて際立つ点を1つ）

情報がない項目は「不明」と記載。冗長な説明は不要。`,
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve({ base64: e.target.result.split(',')[1], mimeType: file.type || 'application/octet-stream' })
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'))
    reader.readAsDataURL(file)
  })
}

function FileUploadZone({ summaryType, apiKey, onTextExtracted }) {
  const [dragging, setDragging] = useState(false)
  const [fileNames, setFileNames] = useState([])
  const [extracting, setExtracting] = useState(false)
  const [fileError, setFileError] = useState('')
  const inputRef = useRef()

  const callGemini = async (parts) => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
        }),
      }
    )
    const data = await res.json()
    if (data.error) throw new Error(data.error.message)
    return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }

  const extractFromFile = async (file) => {
    const ext = file.name.split('.').pop().toLowerCase()
    const audioExts = ['mp3', 'mp4', 'm4a', 'wav', 'aac', 'ogg', 'flac', 'webm']
    const audioMimeMap = { mp3: 'audio/mpeg', mp4: 'audio/mp4', m4a: 'audio/mp4', wav: 'audio/wav', aac: 'audio/aac', ogg: 'audio/ogg', flac: 'audio/flac', webm: 'audio/webm' }
    const docMimeMap = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
    const prompt = SUMMARY_PROMPTS[summaryType]

    if (ext === 'txt') {
      const raw = await file.text()
      return await callGemini([{ text: prompt + '\n\n【内容】\n' + raw }])
    } else if (ext === 'pdf' || ext === 'docx') {
      const { base64 } = await readFileAsBase64(file)
      return await callGemini([{ inline_data: { mime_type: docMimeMap[ext], data: base64 } }, { text: prompt }])
    } else if (audioExts.includes(ext)) {
      const { base64 } = await readFileAsBase64(file)
      return await callGemini([
        { inline_data: { mime_type: audioMimeMap[ext] || 'audio/mpeg', data: base64 } },
        { text: 'この音声を文字起こしした上で、以下の指示に従って情報を整理してください。\n\n' + prompt },
      ])
    } else {
      throw new Error(`「${file.name}」は対応していない形式です（txt / pdf / docx / mp3 / m4a / wav など）`)
    }
  }

  const handleFiles = async (files) => {
    if (!files.length) return
    setFileError(''); setExtracting(true)
    setFileNames(Array.from(files).map((f) => f.name))
    try {
      const results = await Promise.all(Array.from(files).map((f) => extractFromFile(f)))
      if (results.length === 1) {
        onTextExtracted(results[0])
      } else {
        const merged = await callGemini([{
          text: SUMMARY_PROMPTS[summaryType] + '\n\n以下は複数ファイルから抽出した情報です。統合して重複を除き1つにまとめてください。\n\n' +
            results.map((r, i) => `【ファイル${i + 1}】\n${r}`).join('\n\n'),
        }])
        onTextExtracted(merged)
      }
    } catch (e) { setFileError(e.message); setFileNames([]) }
    finally { setExtracting(false) }
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{ ...s.dropZone, ...(dragging ? s.dropZoneActive : {}), ...(extracting ? s.dropZoneLoading : {}) }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files) }}
        onClick={() => !extracting && inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".txt,.pdf,.docx,.mp3,.mp4,.m4a,.wav,.aac,.ogg,.flac,.webm" multiple style={{ display: 'none' }}
          onChange={(e) => e.target.files.length && handleFiles(e.target.files)} />
        {extracting ? (
          <div style={s.dzInner}><div style={s.spinnerSm} /><span style={s.dzText}>{fileNames.length > 1 ? `${fileNames.length}件を読み取り中...` : '読み取り中...'}</span></div>
        ) : fileNames.length > 0 ? (
          <div style={s.dzInner}><span>✅</span><span style={s.dzTextOk}>{fileNames.length === 1 ? fileNames[0] : `${fileNames.length}件のファイル`}</span><span style={s.dzHint}>クリックで変更</span></div>
        ) : (
          <div style={s.dzInner}><span>📎</span><span style={s.dzText}>ファイルをドロップ or クリック（複数可）</span><span style={s.dzHint}>txt / pdf / docx / 音声</span></div>
        )}
      </div>
      {fileNames.length > 1 && !extracting && (
        <div style={s.fileNameList}>{fileNames.map((n, i) => <span key={i} style={s.fileNameTag}>{n}</span>)}</div>
      )}
      {fileError && <p style={s.fileError}>{fileError}</p>}
    </div>
  )
}

function AdminPanel({ apiKey, onSave, onClose }) {
  const [input, setInput] = useState(apiKey)
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')

  const handleSave = () => {
    if (!input.trim().startsWith('AIza')) { setErr('形式が正しくありません（AIzaから始まるキーを入力してください）'); return }
    onSave(input.trim()); setSaved(true); setErr('')
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={s.adminOverlay}>
      <div style={s.adminCard}>
        <div style={s.adminHeader}>
          <span style={{ fontSize: 20 }}>⚙️</span>
          <h2 style={s.adminTitle}>管理設定</h2>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>
        <div style={s.adminBody}>
          <div style={s.adminSection}>
            <label style={s.adminLabel}>Gemini APIキー</label>
            <p style={s.adminDesc}>Google AI Studio で取得したAPIキーを設定してください。<br />設定後は通常画面には表示されません。</p>
            <div style={{ position: 'relative' }}>
              <input type={showKey ? 'text' : 'password'} value={input} onChange={(e) => setInput(e.target.value)}
                placeholder="AIza..." style={s.adminInput} />
              <button onClick={() => setShowKey((v) => !v)} style={s.eyeBtn}>{showKey ? '🙈' : '👁️'}</button>
            </div>
            {err && <p style={s.adminErr}>{err}</p>}
            {apiKey && <p style={s.adminStatus}>✅ 現在設定済み：{apiKey.slice(0, 8)}{'*'.repeat(20)}</p>}
          </div>
          <div style={s.adminSection}>
            <label style={s.adminLabel}>使用モデル</label>
            <div style={s.adminModelBadge}>gemini-2.0-flash</div>
            <p style={s.adminDesc}>無料枠で利用可能なモデルです。</p>
          </div>
        </div>
        <div style={s.adminFooter}>
          <button onClick={onClose} style={s.cancelBtn}>キャンセル</button>
          <button onClick={handleSave} style={s.saveBtn}>{saved ? '✓ 保存しました' : '保存する'}</button>
        </div>
      </div>
    </div>
  )
}

export default function CAScriptTool() {
  const [apiKey, setApiKey] = useState('')
  const [showAdmin, setShowAdmin] = useState(false)
  const [phase, setPhase] = useState('initial')
  const [candidateType, setCandidateType] = useState('condition')
  const [otherProcess, setOtherProcess] = useState('none')
  const [otherProcessDetail, setOtherProcessDetail] = useState('')
  const [reason, setReason] = useState('')
  const [jobInfo, setJobInfo] = useState('')
  const [objection, setObjection] = useState('')
  const [loading, setLoading] = useState(false)
  const [script, setScript] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('ca_gemini_key')
    if (saved) setApiKey(saved)
  }, [])

  const handleSaveKey = (key) => {
    setApiKey(key)
    localStorage.setItem('ca_gemini_key', key)
  }

  const buildPrompt = () => {
    const type = CANDIDATE_TYPES.find((t) => t.value === candidateType)
    const op = OTHER_PROCESS_OPTIONS.find((o) => o.value === otherProcess)
    const otherProcessInstruction =
      otherProcess === 'none'
        ? '・他に並行している選考はない。焦らせる必要はないが、動機付けをしっかり行う'
        : otherProcess === 'ongoing'
        ? `・他社の選考が並行して進んでいる（詳細：${otherProcessDetail || '不明'}）\n・スピード感を持って面接設定に持ち込む。「他社と比較検討する上でもぜひ見てほしい」という角度で話す\n・他社を否定せず、この求人の独自の強みを際立たせる`
        : `・他社で最終面接 or 内定が出そうな状況（詳細：${otherProcessDetail || '不明'}）\n・緊急度が高い。「ぜひこの求人も比較した上で決めてほしい」と強めに背中を押す\n・「内定が出る前に一度だけ話を聞いてほしい」というトーンで面接設定を急ぐ\n・他社内定を尊重しながらも、この求人を見ずに決断することへの惜しさを伝える`

    return `あなたは転職エージェント（キャリアアドバイザー）です。
以下の情報をもとに、CAが電話でそのまま使えるトークスクリプトを日本語で作成してください。

【求職者の転職理由・現状・不満】
${reason}

【提案求人の情報】
${jobInfo}

【フェーズ】
${PHASES.find((p) => p.value === phase)?.label}
${phase === 'objection' ? `\n【懸念内容】\n${objection}` : ''}
${phase === 'interview_prep' ? `\nこのフェーズの目的は「面接前に求職者の不安を取り除き、自信を持って面接に臨ませること」です。\n- 面接でよく聞かれる質問と、この求職者に合った回答の方向性を整理する\n- 志望動機を転職理由と求人の魅力を接続して自然な言葉でまとめる手助けをする\n- 「こう話せばいい」という具体的なアドバイスをセリフ形式で伝える\n- 最後に「準備できたので自信を持って行ってください」と背中を押す一言を入れる` : ''}
${phase === 'test_closing' ? `\nこのフェーズの目的は「内定が出た場合に本当に承諾するかどうかを事前に確認すること」です。\n- 「もし内定が出たら、入社の意向はどのくらいありますか？」という問いかけをナチュラルに入れる\n- 承諾を迷わせている懸念・条件・競合他社の状況を引き出す質問をする\n- 「内定承諾の障壁になりそうなもの」を会話の中でCAが把握できるよう誘導する\n- 押しつけず「一緒に整理しましょう」のスタンスで話す` : ''}

【他選考の状況：${op?.label}】
${otherProcessInstruction}

【求職者タイプ：${type?.label}（${type?.desc}）】
このタイプに合わせた文体・話し方で書くこと：
${type?.tone}

【共通出力ルール】
- 電話でそのまま読めるセリフ形式で書く
- 求職者の転職理由に必ず接続させる
- 求人特徴を羅列しない。「なぜこの求職者にこの求人なのか」を一言で語れるようにする
- 懸念がある場合は先手で切り返す
- 最後に次のアクション（面接設定 or 返事の期日確認）を促す一言を入れる
- 「〜でございます」は使わない
- 400〜600字程度`
  }

  const generateScript = async () => {
    if (!apiKey) { setError('管理画面でAPIキーを設定してください'); return }
    if (!reason.trim() || !jobInfo.trim()) { setError('転職理由と求人情報は必須です'); return }
    if (phase === 'objection' && !objection.trim()) { setError('懸念内容を入力してください'); return }
    setError(''); setLoading(true); setScript('')
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: buildPrompt() }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
          }),
        }
      )
      const data = await res.json()
      if (data.error) setError(`APIエラー: ${data.error.message}`)
      else setScript(data.candidates?.[0]?.content?.parts?.[0]?.text || '')
    } catch (e) { setError(`通信エラー: ${e?.message || '不明'}`) }
    finally { setLoading(false) }
  }

  const handleCopy = () => { navigator.clipboard.writeText(script); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        body { margin: 0; }
        .ca-body { display: flex; min-height: 580px; }
        .ca-input-panel { flex: 0 0 480px; padding: 24px 28px; border-right: 1px solid rgba(255,255,255,0.08); overflow-y: auto; }
        .ca-output-panel { flex: 1; padding: 24px 28px; display: flex; flex-direction: column; }
        @media (max-width: 768px) {
          .ca-body { flex-direction: column; min-height: unset; }
          .ca-input-panel { flex: none; width: 100%; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.08); padding: 16px; }
          .ca-output-panel { padding: 16px; }
        }
      `}</style>

      <div style={s.wrapper}>
        {showAdmin && <AdminPanel apiKey={apiKey} onSave={handleSaveKey} onClose={() => setShowAdmin(false)} />}

        <div style={s.container}>
          <div style={s.header}>
            <span style={{ fontSize: 28 }}>📞</span>
            <div>
              <h1 style={s.headerTitle}>CA Script Generator</h1>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>
                {apiKey ? <span style={{ color: '#86efac', fontSize: 12 }}>● API接続済み</span> : <span style={{ color: '#fca5a5', fontSize: 12 }}>● APIキー未設定</span>}
              </p>
            </div>
            <button onClick={() => setShowAdmin(true)} style={s.adminBtn}>⚙️ 管理</button>
          </div>

          <div className="ca-body">
            <div className="ca-input-panel">

              <div style={s.section}>
                <label style={s.label}>フェーズ</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {PHASES.map((p) => (
                    <button key={p.value} onClick={() => setPhase(p.value)}
                      style={{ ...s.phaseBtn, ...(phase === p.value ? s.phaseBtnActive : {}) }}>{p.label}</button>
                  ))}
                </div>
              </div>

              <div style={s.section}>
                <label style={s.label}>求職者タイプ</label>
                <div style={s.typeGrid}>
                  {CANDIDATE_TYPES.map((t) => (
                    <button key={t.value} onClick={() => setCandidateType(t.value)}
                      style={{ ...s.typeBtn, ...(candidateType === t.value ? s.typeBtnActive : {}) }}>
                      <span style={s.typeEmoji}>{t.emoji}</span>
                      <span style={s.typeLabel}>{t.label}</span>
                      <span style={s.typeDesc}>{t.desc}</span>
                      {candidateType === t.value && <span style={s.typeCheck}>✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div style={s.section}>
                <label style={s.label}>求職者の転職理由・現状・不満<span style={s.required}>必須</span></label>
                <FileUploadZone summaryType="candidate" apiKey={apiKey} onTextExtracted={setReason} />
                <textarea value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder="例：現職は施工管理で残業が月80時間超。体力的にきつく、家族との時間も取れない。年収は450万。資格はないが現場経験5年あり。将来的に内勤に移りたい気持ちもある。"
                  style={s.textarea} rows={4} />
              </div>

              <div style={s.section}>
                <label style={s.label}>提案求人の情報<span style={s.required}>必須</span></label>
                <FileUploadZone summaryType="job" apiKey={apiKey} onTextExtracted={setJobInfo} />
                <textarea value={jobInfo} onChange={(e) => setJobInfo(e.target.value)}
                  placeholder="例：施工管理職。年収500〜600万。残業月平均30時間。土日祝休み。資格取得支援あり。本社は品川で転勤なし。将来的に積算・営業へのキャリアパスあり。"
                  style={s.textarea} rows={4} />
              </div>

              <div style={s.section}>
                <label style={s.label}>他選考の状況</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  {OTHER_PROCESS_OPTIONS.map((o) => (
                    <button key={o.value} onClick={() => setOtherProcess(o.value)}
                      style={{ ...s.otherBtn, ...(otherProcess === o.value ? s.otherBtnActive : {}) }}>
                      <span style={{ pointerEvents: 'none', fontSize: 14 }}>{o.emoji}</span>
                      <span style={{ pointerEvents: 'none', fontSize: 12, fontWeight: 600 }}>{o.label}</span>
                    </button>
                  ))}
                </div>
                {otherProcess !== 'none' && (
                  <input type="text" value={otherProcessDetail} onChange={(e) => setOtherProcessDetail(e.target.value)}
                    placeholder={otherProcess === 'ongoing' ? '例：Web系2社と並行。来週1社目の2次面接' : '例：A社から内定。返答期限が今週金曜'}
                    style={s.textInput} />
                )}
                <p style={s.otherHint}>{OTHER_PROCESS_OPTIONS.find((o) => o.value === otherProcess)?.desc}</p>
              </div>

              {phase === 'objection' && (
                <div style={s.section}>
                  <label style={s.label}>懸念内容<span style={s.required}>必須</span></label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {OBJECTION_TYPES.map((o) => (
                      <button key={o} onClick={() => setObjection(o)}
                        style={{ ...s.chip, ...(objection === o ? s.chipActive : {}) }}>{o}</button>
                    ))}
                  </div>
                  <input type="text" value={objection} onChange={(e) => setObjection(e.target.value)}
                    placeholder="上記以外はここに直接入力" style={s.textInput} />
                </div>
              )}

              {error && <p style={s.error}>{error}</p>}

              <button onClick={generateScript} disabled={loading}
                style={{ ...s.primaryBtn, width: '100%', marginTop: 8, opacity: loading ? 0.7 : 1 }}>
                {loading
                  ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><span style={s.spinner} />生成中...</span>
                  : 'スクリプト生成'}
              </button>
            </div>

            <div className="ca-output-panel">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={s.label}>生成スクリプト</span>
                {script && <button onClick={handleCopy} style={s.copyBtn}>{copied ? '✓ コピー済み' : 'コピー'}</button>}
              </div>
              <div style={s.outputBox}>
                {loading ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                    <div style={s.spinnerLg} />
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: 0 }}>スクリプトを生成中...</p>
                  </div>
                ) : script ? (
                  <pre style={s.scriptText}>{script}</pre>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                    <p style={{ fontSize: 40, margin: 0 }}>✍️</p>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, textAlign: 'center', lineHeight: 1.8, margin: 0 }}>
                      左側に情報を入力して<br />「スクリプト生成」を押してください
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

const s = {
  wrapper: { minHeight: '100vh', background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #0f0f1a 100%)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px 8px', fontFamily: "'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif" },
  container: { width: '100%', maxWidth: 1100, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 700, margin: '0 0 2px' },
  adminBtn: { marginLeft: 'auto', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: 'rgba(255,255,255,0.6)', fontSize: 13, padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
  section: { marginBottom: 20 },
  label: { display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600, marginBottom: 8 },
  required: { background: 'rgba(239,68,68,0.2)', color: '#f87171', fontSize: 10, padding: '2px 6px', borderRadius: 4 },
  phaseBtn: { padding: '9px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  phaseBtnActive: { background: 'rgba(99,102,241,0.3)', border: '1px solid rgba(99,102,241,0.6)', color: '#a5b4fc' },
  typeGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  typeBtn: { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, padding: '12px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, cursor: 'pointer', textAlign: 'left', color: 'inherit', fontFamily: 'inherit', width: '100%' },
  typeBtnActive: { background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.55)' },
  typeEmoji: { fontSize: 20, lineHeight: 1, pointerEvents: 'none' },
  typeLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 700, pointerEvents: 'none' },
  typeDesc: { color: 'rgba(255,255,255,0.35)', fontSize: 11, lineHeight: 1.4, pointerEvents: 'none' },
  typeCheck: { position: 'absolute', top: 8, right: 10, color: '#a5b4fc', fontSize: 13, fontWeight: 700, pointerEvents: 'none' },
  dropZone: { border: '1.5px dashed rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', marginBottom: 8 },
  dropZoneActive: { border: '1.5px dashed rgba(99,102,241,0.6)', background: 'rgba(99,102,241,0.08)' },
  dropZoneLoading: { border: '1.5px dashed rgba(99,102,241,0.4)', cursor: 'not-allowed' },
  dzInner: { display: 'flex', alignItems: 'center', gap: 8 },
  dzText: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  dzTextOk: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 600 },
  dzHint: { color: 'rgba(255,255,255,0.25)', fontSize: 11, marginLeft: 'auto' },
  fileError: { color: '#f87171', fontSize: 12, margin: '0 0 4px', background: 'rgba(239,68,68,0.1)', padding: '6px 10px', borderRadius: 6 },
  fileNameList: { display: 'flex', flexWrap: 'wrap', gap: 4, margin: '4px 0 8px' },
  fileNameTag: { background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, color: '#a5b4fc', fontSize: 11, padding: '2px 8px' },
  textarea: { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 14px', color: '#fff', fontSize: 13, lineHeight: 1.7, resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  textInput: { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  chip: { padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer' },
  chipActive: { background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.5)', color: '#a5b4fc' },
  otherBtn: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '10px 8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontFamily: 'inherit' },
  otherBtnActive: { background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.5)', color: '#a5b4fc' },
  otherHint: { color: 'rgba(255,255,255,0.25)', fontSize: 11, margin: '6px 0 0' },
  primaryBtn: { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', borderRadius: 12, padding: '14px 24px', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  spinner: { width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' },
  spinnerSm: { width: 14, height: 14, border: '2px solid rgba(99,102,241,0.3)', borderTop: '2px solid #a5b4fc', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  spinnerLg: { width: 40, height: 40, border: '3px solid rgba(99,102,241,0.2)', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  error: { color: '#f87171', fontSize: 13, margin: '8px 0 0', background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: 8 },
  copyBtn: { background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 8, color: '#a5b4fc', fontSize: 13, padding: '6px 14px', cursor: 'pointer' },
  outputBox: { flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '16px', overflowY: 'auto', minHeight: 200, display: 'flex', flexDirection: 'column' },
  scriptText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 2, whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' },
  adminOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' },
  adminCard: { background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, width: '100%', maxWidth: 480, overflow: 'hidden' },
  adminHeader: { display: 'flex', alignItems: 'center', gap: 12, padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' },
  adminTitle: { color: '#fff', fontSize: 17, fontWeight: 700, margin: 0, flex: 1 },
  closeBtn: { background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 18, cursor: 'pointer', padding: '4px 8px' },
  adminBody: { padding: '24px' },
  adminSection: { marginBottom: 28 },
  adminLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 },
  adminDesc: { color: 'rgba(255,255,255,0.35)', fontSize: 12, lineHeight: 1.7, margin: '0 0 12px' },
  adminInput: { width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '11px 44px 11px 14px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  eyeBtn: { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4 },
  adminErr: { color: '#f87171', fontSize: 12, margin: '8px 0 0' },
  adminStatus: { color: '#86efac', fontSize: 12, margin: '8px 0 0', background: 'rgba(134,239,172,0.08)', padding: '6px 10px', borderRadius: 6 },
  adminModelBadge: { display: 'inline-block', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 6, color: '#a5b4fc', fontSize: 12, padding: '4px 10px', marginBottom: 6 },
  adminFooter: { display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.07)' },
  cancelBtn: { background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: 'rgba(255,255,255,0.5)', fontSize: 14, padding: '10px 20px', cursor: 'pointer' },
  saveBtn: { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, padding: '10px 24px', cursor: 'pointer' },
}
