"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"

type Kind = "fecho" | "lembranca"
type Art = { id?: string | number; name: string; kind: Kind; label: string; color: string }

const fresh: Art = { name: "", kind: "fecho", label: "Mundo Natural", color: "#315a40" }
const formats = {
  fecho: { title: "Fecho de saco", width: 76, height: 20, textX: 43, textY: 6.8, textWidth: 55, leafX: 7 },
  lembranca: { title: "Lembrancinha com furo", width: 60, height: 28, textX: 34, textY: 15, textWidth: 42, leafX: 14 },
}
const leaves = [
  [[0, 0], [-1.9, -0.5], [-3.2, -1.8], [-3.5, -3.7], [-1.9, -3.3], [-0.5, -2], [0.2, -0.6]],
  [[0.1, 0.4], [0.3, -1.3], [1.4, -3.3], [3.6, -4.3], [3.3, -2.3], [1.9, -0.5]],
]
const slot = [[10, 14], [68, 14], [77, 11.7], [77, 17.5], [68, 15], [10, 15]]
const pointList = (points: number[][]) => points.map(p => p.join(",")).join(" ")

function modelSource(art: Art) {
  const shape = formats[art.kind]
  const label = JSON.stringify(art.label.trim().replace(/[\u0000-\u001f]/g, " "))
  // Mirror the SVG's top-down coordinates before extrusion; keep lettering upright.
  return `// Mundo Natural • medidas em milímetros
$fn = 64;
espessura = 2.8;
relevo = 0.6;
legenda = ${label};
module corpo() {
  difference() {
    translate([3,3]) offset(r=3) square([${shape.width - 6},${shape.height - 6}]);
    ${art.kind === "fecho"
      ? `polygon(${JSON.stringify(slot)}); translate([10,14.5]) circle(r=1.35);`
      : "translate([5.5,14]) circle(r=2);"}
  }
}
module inverter() { translate([0,${shape.height}]) mirror([0,1]) children(); }
linear_extrude(espessura) inverter() corpo();
translate([0,0,espessura-0.02]) linear_extrude(relevo+0.02) {
  inverter() translate([${shape.leafX},${art.kind === "fecho" ? 8 : 8.2}]) {
    ${leaves.map(points => `polygon(${JSON.stringify(points)});`).join("\n    ")}
  }
  translate([${shape.textX},${shape.height - shape.textY}])
    resize([${Math.min(shape.textWidth, Math.max(4, art.label.trim().length * 2.7))},4,0])
      text(legenda, size=4, halign="center", valign="center", font="Liberation Sans:style=Bold");
}
`
}

function download(content: string, mime: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function loadArts(): Promise<Art[]> {
  const response = await fetch("/api/loja?view=arts", { cache: "no-store" })
  if (!response.ok) throw new Error("Não foi possível carregar as artes. Verifique sua sessão.")
  const { arts } = await response.json()
  return arts
}

export default function ArtStudio() {
  const [art, setArt] = useState<Art>({ ...fresh })
  const [arts, setArts] = useState<Art[]>([])
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const svg = useRef<SVGSVGElement>(null)
  const shape = formats[art.kind]
  const stem = (art.name.trim() || art.kind).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").slice(0, 60) || "mundo-natural"
  const safeColor = /^#[0-9a-f]{6}$/i.test(art.color) ? art.color : fresh.color
  const labelLength = Math.min(shape.textWidth, Math.max(4, art.label.trim().length * 2.7))

  useEffect(() => {
    let active = true
    loadArts().then(items => { if (active) setArts(items) })
      .catch(error => { if (active) setMessage(error.message) })
    return () => { active = false }
  }, [])

  async function manage(action: "saveArt" | "deleteArt") {
    if (busy || (action === "deleteArt" && !window.confirm("Excluir esta arte salva?"))) return
    setBusy(true)
    setMessage("")
    try {
      const body = action === "deleteArt" ? { action, id: art.id } : { ...art, action, name: art.name.trim(), label: art.label.trim() }
      const response = await fetch("/api/loja", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error((await response.json()).error || "Não foi possível concluir a alteração.")
      const list = await loadArts()
      setArts(list)
      setArt({ ...fresh })
      setMessage(action === "saveArt" ? "Arte salva na coleção." : "Arte excluída.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao acessar a coleção.")
    } finally { setBusy(false) }
  }
  function submit(event: FormEvent) { event.preventDefault(); void manage("saveArt") }
  function exportSvg() {
    if (!svg.current) return
    const copy = svg.current.cloneNode(true) as SVGSVGElement
    copy.removeAttribute("class")
    // XMLSerializer escapes the customized label and title as text nodes.
    download(new XMLSerializer().serializeToString(copy), "image/svg+xml;charset=utf-8", stem + ".svg")
  }
  const inputClass = "mt-1 block w-full rounded-md border px-3 py-2 bg-white"
  const secondary = "rounded-md border px-4 py-2 text-sm font-medium"
  return <section aria-label="Ateliê de embalagens" className="space-y-5">
    <div><h2 className="text-2xl font-semibold">Ateliê de embalagens</h2>
      <p className="text-sm">Personalize os fechos e as lembrancinhas da Mundo Natural.</p>
    </div>
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={submit} className="space-y-4">
        <label className="block">Nome para salvar<input className={inputClass} required maxLength={60} value={art.name} onChange={e => setArt({ ...art, name: e.target.value })} placeholder="Ex. Fecho da coleção de chás" /></label>
        <label className="block">Modelo<select className={inputClass} value={art.kind} onChange={e => setArt({ ...art, kind: e.target.value as Kind })}>
          <option value="fecho">Fecho de saco</option><option value="lembranca">Lembrancinha com furo</option>
        </select></label>
        <label className="block">Texto da peça<input className={inputClass} required maxLength={24} value={art.label} onChange={e => setArt({ ...art, label: e.target.value })} /></label>
        <label className="flex items-center gap-3">Cor da arte<input type="color" value={safeColor} onChange={e => setArt({ ...art, color: e.target.value })} /></label>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy || !art.label.trim() || !art.name.trim()} className="rounded-md bg-[#315a40] px-4 py-2 text-white disabled:opacity-50">{art.id == null ? "Salvar na coleção" : "Salvar alterações"}</button>
          {art.id != null && <><button type="button" className={secondary} disabled={busy} onClick={() => setArt({ ...art, id: undefined, name: (art.name + " (cópia)").slice(0, 60) })}>Criar cópia</button>
            <button type="button" className={secondary} disabled={busy} onClick={() => void manage("deleteArt")}>Excluir</button></>}
        </div>
      </form>
      <div className="space-y-3">
        <div className="flex min-h-44 items-center justify-center rounded-xl bg-[#f2efe7] p-8">
          <svg ref={svg} xmlns="http://www.w3.org/2000/svg" width={shape.width + "mm"} height={shape.height + "mm"} viewBox={`0 0 ${shape.width} ${shape.height}`} className="h-auto w-full" role="img" aria-label="Prévia da peça">
            <title>{art.name || shape.title}</title>
            <defs><mask id="corte"><rect width="100%" height="100%" fill="white" />
              {art.kind === "fecho" ? <g fill="black"><polygon points={pointList(slot)} /><circle cx="10" cy="14.5" r="1.35" /></g>
                : <circle cx="5.5" cy="14" r="2" fill="black" />}</mask></defs>
            <rect width={shape.width} height={shape.height} rx="3" fill={safeColor} mask="url(#corte)" />
            <g fill="#faf5df" transform={`translate(${shape.leafX} ${art.kind === "fecho" ? 8 : 8.2})`}>{leaves.map((points, i) => <polygon key={i} points={pointList(points)} />)}</g>
            <text x={shape.textX} y={shape.textY} dominantBaseline="central" textAnchor="middle" textLength={labelLength} lengthAdjust="spacingAndGlyphs" fill="#faf5df" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="5">{art.label.trim()}</text>
          </svg>
        </div>
        <p className="text-sm">{shape.width} × {shape.height} mm · Base de 2,8 mm · Relevo de 0,6 mm</p>
        <div className="flex flex-wrap gap-2"><button type="button" disabled={!art.label.trim()} className={secondary} onClick={exportSvg}>Baixar arte SVG</button>
          <button type="button" disabled={!art.label.trim()} className={secondary} onClick={() => download(modelSource(art), "text/plain;charset=utf-8", stem + ".scad")}>Baixar modelo 3D (.scad)</button></div>
        <p className="text-sm">Abra o .scad no OpenSCAD, renderize com F6 e exporte em STL. No Bambu Studio, selecione a A1 e teste uma peça antes do lote.</p>
      </div>
    </div>
    <p role="status" aria-live="polite">{message}</p>
    <div><h3 className="mb-2 font-semibold">Artes salvas</h3>
      {arts.length === 0 ? <p className="text-sm">As artes salvas aparecem aqui.</p> :
        <ul className="grid gap-2 sm:grid-cols-2">{arts.map(item => <li key={item.id}><button type="button" disabled={busy} className="w-full rounded-md border p-3 text-left" onClick={() => { setArt({ ...item }); setMessage("Arte aberta para edição.") }}>
          <strong>{item.name}</strong><span className="block text-sm">{formats[item.kind].title} · {item.label}</span>
        </button></li>)}</ul>}
    </div>
  </section>
}
