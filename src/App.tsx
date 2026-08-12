import { useState, useRef } from "react";
import { Gauge, Droplet, Pencil, Trash2, Plus, X, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

// ====================================================================
// VERSÃO PARA DEPLOY (StackBlitz / CodeSandbox / Vercel / Netlify)
// Diferença em relação à versão do chat: usa localStorage do navegador
// no lugar de window.storage (que só existe dentro do Claude.ai).
// Cada pessoa que abrir o link terá seus próprios dados salvos
// localmente, no navegador dela.
// ====================================================================

const OIL_INTERVAL = 10000;
const CATEGORIAS = ["Manutenção", "Lavagem", "Pedágio", "Estacionamento", "Alimentação", "Outros"];

const fmtKm = (n) => new Intl.NumberFormat("pt-BR").format(Math.round(n || 0));
const fmtMoney = (n) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
const fmtDate = (ts) => new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const fmtDateFull = (ts) =>
  new Date(ts).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });

const getMonday = (ts) => {
  const d = new Date(ts);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const toDateInputValue = (ts) => {
  const d = new Date(ts);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

const getLastKmFinal = (list) => {
  if (!list.length) return "";
  const last = [...list].sort((a, b) => b.data - a.data)[0];
  return String(last.kmFinal);
};

// --- leitura/gravação no localStorage, com fallback seguro ---
const lsGet = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch (e) {
    return fallback;
  }
};
const lsSet = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
};

const emptyForm = {
  data: toDateInputValue(Date.now()),
  kmInicial: "",
  kmFinal: "",
  rendaBruta: "",
  horasTrabalhadas: "",
  numeroCorridas: "",
  abastecimentoItems: [],
  despesasItems: [],
};

const divSafe = (a, b) => (b > 0 ? a / b : 0);
const fmtMoneyHora = (n) => `${fmtMoney(n)}/h`;

export default function ControleUber() {
  const [dias, setDias] = useState(() => lsGet("uber-dias", []));
  const [kmOdometroTroca, setKmOdometroTroca] = useState(() => lsGet("uber-km-odometro-troca", 0));
  const [odometroBase, setOdometroBase] = useState(() => lsGet("uber-odometro-base", 0));
  const [odometroBaselineKm, setOdometroBaselineKm] = useState(() =>
    lsGet("uber-odometro-baseline-km", 0)
  );
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    kmInicial: getLastKmFinal(lsGet("uber-dias", [])),
  }));
  const [editingId, setEditingId] = useState(null);
  const formRef = useRef(null);
  const [error, setError] = useState("");
  const [openWeeks, setOpenWeeks] = useState({});
  const [novaDespesaCat, setNovaDespesaCat] = useState(CATEGORIAS[0]);
  const [novaDespesaValor, setNovaDespesaValor] = useState("");
  const [novoAbastecimentoValor, setNovoAbastecimentoValor] = useState("");
  const [odometroInput, setOdometroInput] = useState("");
  const [editandoOdometro, setEditandoOdometro] = useState(false);
  const [trocaInput, setTrocaInput] = useState("");
  const [editandoTroca, setEditandoTroca] = useState(false);

  const persistDias = (next) => {
    setDias(next);
    lsSet("uber-dias", next);
  };
  const persistKmOdometroTroca = (next) => {
    setKmOdometroTroca(next);
    lsSet("uber-km-odometro-troca", next);
  };

  const num = (v) => parseFloat(String(v).replace(",", ".")) || 0;
  const kmInicial = num(form.kmInicial);
  const kmFinal = num(form.kmFinal);
  const rendaBruta = num(form.rendaBruta);
  const abastecimento = form.abastecimentoItems.reduce((a, it) => a + it, 0);
  const despesasTotal = form.despesasItems.reduce((a, it) => a + it.valor, 0);
  const kmRodados = kmFinal - kmInicial;
  const rendaLiquida = rendaBruta - abastecimento - despesasTotal;
  const horasTrabalhadas = num(form.horasTrabalhadas);
  const numeroCorridas = num(form.numeroCorridas);
  const valorHoraBruta = divSafe(rendaBruta, horasTrabalhadas);
  const valorHoraLiquida = divSafe(rendaLiquida, horasTrabalhadas);
  const ticketMedio = divSafe(rendaBruta, numeroCorridas);

  const totalKmGeral = dias.reduce((a, d) => a + d.kmRodados, 0);
  const odometroReal = odometroBase + (totalKmGeral - odometroBaselineKm);

  const resetForm = (list = dias) => {
    setForm({ ...emptyForm, data: toDateInputValue(Date.now()), despesasItems: [], kmInicial: getLastKmFinal(list) });
    setEditingId(null);
    setError("");
    setNovaDespesaValor("");
  };

  const handleSetOdometro = () => {
    const v = parseFloat(String(odometroInput).replace(",", "."));
    if (!v && v !== 0) return;
    setOdometroBase(v);
    setOdometroBaselineKm(totalKmGeral);
    lsSet("uber-odometro-base", v);
    lsSet("uber-odometro-baseline-km", totalKmGeral);
    setOdometroInput("");
    setEditandoOdometro(false);
  };

  const handleAddDespesa = () => {
    const v = num(novaDespesaValor);
    if (!v) return;
    setForm({ ...form, despesasItems: [...form.despesasItems, { categoria: novaDespesaCat, valor: v }] });
    setNovaDespesaValor("");
  };
  const handleRemoveDespesa = (idx) => {
    setForm({ ...form, despesasItems: form.despesasItems.filter((_, i) => i !== idx) });
  };
  const handleAddAbastecimento = () => {
    const v = num(novoAbastecimentoValor);
    if (!v) return;
    setForm({ ...form, abastecimentoItems: [...form.abastecimentoItems, v] });
    setNovoAbastecimentoValor("");
  };
  const handleRemoveAbastecimento = (idx) => {
    setForm({ ...form, abastecimentoItems: form.abastecimentoItems.filter((_, i) => i !== idx) });
  };

  const handleSave = () => {
    if (!form.kmInicial || !form.kmFinal || !form.rendaBruta) {
      setError("Preencha ao menos km inicial, km final e renda bruta.");
      return;
    }
    if (kmFinal <= kmInicial) {
      setError("Km final precisa ser maior que km inicial.");
      return;
    }
    setError("");
    const ts = new Date(form.data + "T12:00:00").getTime();
    const entry = {
      id: editingId ?? Date.now(),
      data: ts,
      kmInicial,
      kmFinal,
      kmRodados,
      rendaBruta,
      abastecimentoItems: form.abastecimentoItems,
      abastecimento,
      horasTrabalhadas,
      numeroCorridas,
      despesasItems: form.despesasItems,
      despesas: despesasTotal,
      rendaLiquida,
    };

    if (editingId) {
      const nextDias = dias.map((d) => (d.id === editingId ? entry : d));
      persistDias(nextDias);
      resetForm(nextDias);
    } else {
      const nextDias = [...dias, entry];
      persistDias(nextDias);
      resetForm(nextDias);
    }
  };

  const handleEdit = (d) => {
    setForm({
      data: toDateInputValue(d.data),
      kmInicial: String(d.kmInicial),
      kmFinal: String(d.kmFinal),
      rendaBruta: String(d.rendaBruta),
      abastecimentoItems: d.abastecimentoItems ?? [],
      horasTrabalhadas: String(d.horasTrabalhadas ?? ""),
      numeroCorridas: String(d.numeroCorridas ?? ""),
      despesasItems: d.despesasItems ?? [],
    });
    setEditingId(d.id);
    setError("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleDelete = (d) => {
    const nextDias = dias.filter((x) => x.id !== d.id);
    persistDias(nextDias);
    if (editingId === d.id) resetForm(nextDias);
    else if (!editingId) setForm((f) => ({ ...f, kmInicial: getLastKmFinal(nextDias) }));
  };

  const handleTrocaFeita = () => persistKmOdometroTroca(odometroReal);

  const handleSetTroca = () => {
    const v = parseFloat(String(trocaInput).replace(",", "."));
    if (!v && v !== 0) return;
    persistKmOdometroTroca(v);
    setTrocaInput("");
    setEditandoTroca(false);
  };

  const kmDesdeTroca = Math.max(0, odometroReal - kmOdometroTroca);
  const oilPct = Math.min(100, (kmDesdeTroca / OIL_INTERVAL) * 100);
  const oilRemaining = Math.max(0, OIL_INTERVAL - kmDesdeTroca);
  const oilAtraso = Math.max(0, kmDesdeTroca - OIL_INTERVAL);
  const oilColor = oilPct >= 95 ? "bg-rose-500" : oilPct >= 70 ? "bg-amber-500" : "bg-emerald-500";

  const semanasMap = {};
  dias.forEach((d) => {
    const monday = getMonday(d.data);
    if (!semanasMap[monday]) semanasMap[monday] = [];
    semanasMap[monday].push(d);
  });
  const semanas = Object.keys(semanasMap)
    .map(Number)
    .sort((a, b) => b - a)
    .map((monday) => {
      const registros = semanasMap[monday].sort((a, b) => a.data - b.data);
      const totals = registros.reduce(
        (acc, d) => ({
          kmRodados: acc.kmRodados + d.kmRodados,
          rendaBruta: acc.rendaBruta + d.rendaBruta,
          abastecimento: acc.abastecimento + d.abastecimento,
          despesas: acc.despesas + d.despesas,
          rendaLiquida: acc.rendaLiquida + d.rendaLiquida,
          horasTrabalhadas: acc.horasTrabalhadas + (d.horasTrabalhadas || 0),
          numeroCorridas: acc.numeroCorridas + (d.numeroCorridas || 0),
        }),
        { kmRodados: 0, rendaBruta: 0, abastecimento: 0, despesas: 0, rendaLiquida: 0, horasTrabalhadas: 0, numeroCorridas: 0 }
      );
      totals.valorHoraBruta = divSafe(totals.rendaBruta, totals.horasTrabalhadas);
      totals.valorHoraLiquida = divSafe(totals.rendaLiquida, totals.horasTrabalhadas);
      totals.ticketMedio = divSafe(totals.rendaBruta, totals.numeroCorridas);
      const catTotals = {};
      registros.forEach((d) =>
        (d.despesasItems ?? []).forEach((it) => {
          catTotals[it.categoria] = (catTotals[it.categoria] || 0) + it.valor;
        })
      );
      return { monday, registros, totals, catTotals };
    });

  const toggleWeek = (monday) => setOpenWeeks((prev) => ({ ...prev, [monday]: !prev[monday] }));

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4">
      <div className="max-w-md mx-auto space-y-5 pb-10">
        <header className="flex items-center justify-center gap-2 pt-2">
          <Gauge className="text-amber-400" size={26} />
          <h1 className="text-xl font-bold tracking-tight text-red-500 underline decoration-amber-400 decoration-4 underline-offset-4">Rey Driver Mobile</h1>
        </header>

        <div className="bg-zinc-900 border-4 border-zinc-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-widest text-zinc-500">Odômetro real do veículo</p>
            <button
              onClick={() => {
                setEditandoOdometro((v) => !v);
                setOdometroInput(String(Math.round(odometroReal)));
              }}
              className="text-zinc-500 hover:text-amber-400"
            >
              <Pencil size={14} />
            </button>
          </div>
          <div className="bg-black rounded-lg px-3 py-3 inline-block w-full">
            <span className="font-mono text-4xl tracking-widest text-emerald-400 tabular-nums">
              {fmtKm(odometroReal).padStart(6, "0")}
            </span>
          </div>
          {editandoOdometro && (
            <div className="flex gap-2 mt-3">
              <input
                type="text"
                inputMode="decimal"
                placeholder="Km do painel do carro"
                value={odometroInput}
                onChange={(e) => setOdometroInput(e.target.value)}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                onClick={handleSetOdometro}
                className="bg-amber-500 hover:bg-amber-400 transition text-zinc-950 font-semibold rounded-lg px-4 text-sm"
              >
                Salvar
              </button>
            </div>
          )}
          {!editandoOdometro && (
            <p className="text-xs text-zinc-500 mt-2">Some automaticamente com os km rodados de cada dia registrado.</p>
          )}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Droplet size={18} className="text-amber-400" />
            <h2 className="font-semibold text-red-500">Troca de óleo</h2>
            {oilPct >= 95 && <AlertTriangle size={16} className="text-rose-400 ml-auto" />}
            <button
              onClick={() => {
                setEditandoTroca((v) => !v);
                setTrocaInput(String(Math.round(kmOdometroTroca)));
              }}
              className={`text-zinc-500 hover:text-amber-400 ${oilPct >= 95 ? "" : "ml-auto"}`}
            >
              <Pencil size={14} />
            </button>
          </div>
          <div className="h-3 rounded-full bg-zinc-800 overflow-hidden">
            <div className={`h-full ${oilColor} transition-all`} style={{ width: `${oilPct}%` }} />
          </div>
          <p className="text-sm text-zinc-300">
            {fmtKm(kmDesdeTroca)} km desde a última troca ·{" "}
            {oilAtraso > 0 ? (
              <span className="text-rose-400 font-semibold">{fmtKm(oilAtraso)} km em atraso</span>
            ) : (
              <>
                faltam <span className="text-white font-semibold">{fmtKm(oilRemaining)} km</span>
              </>
            )}
          </p>
          {editandoTroca && (
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="decimal"
                placeholder="Odômetro na última troca (km do painel)"
                value={trocaInput}
                onChange={(e) => setTrocaInput(e.target.value)}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                onClick={handleSetTroca}
                className="bg-amber-500 hover:bg-amber-400 transition text-zinc-950 font-semibold rounded-lg px-4 text-sm"
              >
                Salvar
              </button>
            </div>
          )}
          {!editandoTroca && (
            <p className="text-xs text-zinc-500">
              Calculado a partir do odômetro real acima menos o odômetro na última troca.
            </p>
          )}
          <button
            onClick={handleTrocaFeita}
            className="w-full bg-amber-500 hover:bg-amber-400 active:scale-[0.98] transition text-zinc-950 font-semibold rounded-lg py-2 text-sm"
          >
            Marcar troca de óleo feita
          </button>
        </div>

        <div className="bg-zinc-900 border-4 border-zinc-800 rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-widest text-zinc-500 mb-2">Km total rodado (histórico)</p>
          <div className="bg-black rounded-lg px-3 py-3 inline-block w-full">
            <span className="font-mono text-4xl tracking-widest text-amber-400 tabular-nums">
              {fmtKm(totalKmGeral).padStart(6, "0")}
            </span>
          </div>
        </div>

        <div ref={formRef} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3 scroll-mt-4">
          <h2 className="font-semibold text-red-500">{editingId ? "Editar dia" : "Novo dia"}</h2>
          <label className="text-xs text-zinc-500 block">
            Data
            <input
              type="date"
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
              className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Km inicial (auto)" value={form.kmInicial} onChange={(v) => setForm({ ...form, kmInicial: v })} />
            <Field label="Km final" value={form.kmFinal} onChange={(v) => setForm({ ...form, kmFinal: v })} />
            <Field label="Renda bruta (R$)" value={form.rendaBruta} onChange={(v) => setForm({ ...form, rendaBruta: v })} />
            <Field label="Horas trabalhadas" value={form.horasTrabalhadas} onChange={(v) => setForm({ ...form, horasTrabalhadas: v })} />
            <Field label="Número de corridas" value={form.numeroCorridas} onChange={(v) => setForm({ ...form, numeroCorridas: v })} />
          </div>

          <div className="space-y-2">
            <p className="text-xs text-zinc-500">Abastecido (R$)</p>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="decimal"
                placeholder="Valor"
                value={novoAbastecimentoValor}
                onChange={(e) => setNovoAbastecimentoValor(e.target.value)}
                className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                onClick={handleAddAbastecimento}
                className="shrink-0 bg-zinc-700 hover:bg-zinc-600 transition rounded-lg px-4 flex items-center justify-center gap-1 text-sm"
              >
                <Plus size={16} />
                Adicionar
              </button>
            </div>
            {form.abastecimentoItems.length > 0 && (
              <div className="space-y-1">
                {form.abastecimentoItems.map((v, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-zinc-800/60 rounded-lg px-3 py-1.5 text-sm">
                    <span className="text-zinc-300">Abastecimento {idx + 1} — {fmtMoney(v)}</span>
                    <button onClick={() => handleRemoveAbastecimento(idx)} className="text-zinc-500 hover:text-rose-400">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs text-zinc-500">Despesas</p>
            <select
              value={novaDespesaCat}
              onChange={(e) => setNovaDespesaCat(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="decimal"
                placeholder="Valor"
                value={novaDespesaValor}
                onChange={(e) => setNovaDespesaValor(e.target.value)}
                className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                onClick={handleAddDespesa}
                className="shrink-0 bg-zinc-700 hover:bg-zinc-600 transition rounded-lg px-4 flex items-center justify-center gap-1 text-sm"
              >
                <Plus size={16} />
                Adicionar
              </button>
            </div>
            {form.despesasItems.length > 0 && (
              <div className="space-y-1">
                {form.despesasItems.map((it, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-zinc-800/60 rounded-lg px-3 py-1.5 text-sm">
                    <span className="text-zinc-300">
                      {it.categoria} <span className="text-zinc-500">— {fmtMoney(it.valor)}</span>
                    </span>
                    <button onClick={() => handleRemoveDespesa(idx)} className="text-zinc-500 hover:text-rose-400">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {(form.kmInicial || form.kmFinal || form.rendaBruta) && (
            <div className="bg-zinc-800/60 rounded-lg p-3 text-sm space-y-1">
              <Row label="Km rodados no dia" value={`${fmtKm(kmRodados)} km`} />
              <Row label="Total abastecido" value={fmtMoney(abastecimento)} />
              <Row label="Total despesas" value={fmtMoney(despesasTotal)} />
              {horasTrabalhadas > 0 && (
                <>
                  <Row label="R$/hora bruta" value={fmtMoneyHora(valorHoraBruta)} />
                  <Row label="R$/hora líquida" value={fmtMoneyHora(valorHoraLiquida)} color="text-amber-400" />
                </>
              )}
              {numeroCorridas > 0 && <Row label="Ticket médio" value={fmtMoney(ticketMedio)} />}
              <Row
                label="Renda líquida do dia"
                value={fmtMoney(rendaLiquida)}
                color={rendaLiquida >= 0 ? "text-emerald-400" : "text-rose-400"}
                bold
              />
            </div>
          )}

          {error && <p className="text-rose-400 text-sm">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] transition text-zinc-950 font-semibold rounded-lg py-2 text-sm flex items-center justify-center gap-1"
            >
              <Plus size={16} />
              {editingId ? "Atualizar dia" : "Salvar dia"}
            </button>
            {editingId && (
              <button onClick={() => resetForm()} className="bg-zinc-800 hover:bg-zinc-700 transition rounded-lg px-3 flex items-center justify-center">
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="font-semibold px-1 text-red-500">Histórico por semana</h2>
          {semanas.length === 0 && (
            <p className="text-zinc-500 text-sm px-1">Nenhum dia registrado ainda. Adicione o primeiro acima.</p>
          )}
          {semanas.map(({ monday, registros, totals, catTotals }) => {
            const sunday = monday + 6 * 24 * 60 * 60 * 1000;
            const isOpen = !!openWeeks[monday];
            return (
              <div key={monday} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <button onClick={() => toggleWeek(monday)} className="w-full flex items-center justify-between p-3">
                  <div className="text-left">
                    <p className="text-xs text-zinc-500">
                      Semana {fmtDate(monday)} a {fmtDate(sunday)}
                    </p>
                    <p className="text-sm">
                      <span className="text-zinc-400">{fmtKm(totals.kmRodados)} km · </span>
                      <span className={totals.rendaLiquida >= 0 ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                        {fmtMoney(totals.rendaLiquida)}
                      </span>
                    </p>
                  </div>
                  {isOpen ? <ChevronUp size={18} className="text-zinc-500" /> : <ChevronDown size={18} className="text-zinc-500" />}
                </button>
                {isOpen && (
                  <div className="border-t border-zinc-800 p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                      <Row label="Bruta" value={fmtMoney(totals.rendaBruta)} />
                      <Row label="Abastecido" value={fmtMoney(totals.abastecimento)} />
                      <Row label="Despesas" value={fmtMoney(totals.despesas)} />
                      <Row label="Km rodados" value={`${fmtKm(totals.kmRodados)} km`} />
                      <Row label="Horas trabalhadas" value={`${totals.horasTrabalhadas}h`} />
                      <Row label="Corridas" value={String(totals.numeroCorridas)} />
                    </div>
                    {(totals.horasTrabalhadas > 0 || totals.numeroCorridas > 0) && (
                      <div className="bg-zinc-800/40 rounded-lg p-2 space-y-1">
                        <p className="text-xs text-zinc-500 mb-1">Índices da semana</p>
                        {totals.horasTrabalhadas > 0 && (
                          <>
                            <Row label="R$/hora bruta" value={fmtMoneyHora(totals.valorHoraBruta)} />
                            <Row label="R$/hora líquida" value={fmtMoneyHora(totals.valorHoraLiquida)} color="text-amber-400" bold />
                          </>
                        )}
                        {totals.numeroCorridas > 0 && (
                          <Row label="Ticket médio" value={fmtMoney(totals.ticketMedio)} />
                        )}
                      </div>
                    )}
                    {Object.keys(catTotals).length > 0 && (
                      <div className="bg-zinc-800/40 rounded-lg p-2 space-y-1">
                        <p className="text-xs text-zinc-500 mb-1">Despesas por categoria</p>
                        {Object.entries(catTotals).map(([cat, valor]) => (
                          <Row key={cat} label={cat} value={fmtMoney(valor)} />
                        ))}
                      </div>
                    )}
                    <div className="space-y-2">
                      {registros.map((d) => (
                        <div key={d.id} className="bg-zinc-800/60 rounded-lg p-2 text-sm">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-zinc-400 text-xs capitalize">{fmtDateFull(d.data)}</p>
                              <p className="text-zinc-200">
                                {fmtKm(d.kmRodados)} km ·{" "}
                                <span className={d.rendaLiquida >= 0 ? "text-emerald-400" : "text-rose-400"}>
                                  {fmtMoney(d.rendaLiquida)}
                                </span>
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleEdit(d)} className="text-zinc-400 hover:text-amber-400">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => handleDelete(d)} className="text-zinc-400 hover:text-rose-400">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                          {(d.abastecimentoItems ?? []).length > 1 && (
                            <p className="text-xs text-zinc-500 mt-1">
                              {d.abastecimentoItems.length} abastecimentos ·{" "}
                              {d.abastecimentoItems.map((v) => fmtMoney(v)).join(" · ")}
                            </p>
                          )}
                          {(d.despesasItems ?? []).length > 0 && (
                            <p className="text-xs text-zinc-500 mt-1">
                              {d.despesasItems.map((it) => `${it.categoria} ${fmtMoney(it.valor)}`).join(" · ")}
                            </p>
                          )}
                          {(d.horasTrabalhadas > 0 || d.numeroCorridas > 0) && (
                            <p className="text-xs text-zinc-500 mt-1">
                              {d.horasTrabalhadas > 0 &&
                                `${d.horasTrabalhadas}h · ${fmtMoneyHora(divSafe(d.rendaLiquida, d.horasTrabalhadas))}`}
                              {d.horasTrabalhadas > 0 && d.numeroCorridas > 0 && " · "}
                              {d.numeroCorridas > 0 &&
                                `${d.numeroCorridas} corridas · ticket ${fmtMoney(divSafe(d.rendaBruta, d.numeroCorridas))}`}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, full }) {
  return (
    <label className={`text-xs text-zinc-500 ${full ? "col-span-2" : ""}`}>
      {label}
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
    </label>
  );
}

function Row({ label, value, color = "text-zinc-200", bold }) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className={`${color} ${bold ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}
