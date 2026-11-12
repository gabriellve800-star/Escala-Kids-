// Escala Kids v1.2.5 — rascunho local, diffs e envio com compensação.
// Nenhum dado vai para storage, Service Worker ou qualquer cache persistente.
export const availabilityKey = ({dia, culto}) => `${dia}|${culto}`;
export const ownAvailability = (rows, userId) =>
  new Set(rows.filter(row => row.pessoa_id === userId).map(availabilityKey));
export const selectionEqual = (a, b) =>
  a.size === b.size && [...a].every(key => b.has(key));

export function toggleSelection(base, draft, key) {
  const next = new Set(draft || base);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return selectionEqual(base, next) ? null : next;
}
export function availabilityDiff(base, draft) {
  const chosen = draft || base;
  const toRows = (keys) => keys.map(key => {
    const [dia, culto, extra] = key.split('|');
    if (!dia || !culto || extra !== undefined) throw Error('Período inválido.');
    return {dia, culto};
  });
  return {
    add: toRows([...chosen].filter(key => !base.has(key))),
    remove: toRows([...base].filter(key => !chosen.has(key))),
  };
}

/**
 * Sem RPC transacional: envia entradas individuais e compensa, em ordem
 * inversa, qualquer alteração confirmada se uma etapa falhar.
 * Sempre informa se a compensação também falhou. RLS continua definitiva.
 * Jamais modifica base/draft; erro deixa o rascunho para nova tentativa.
 */
export async function saveAvailability({sb, userId, base, draft, validEntry}) {
  if (!draft || selectionEqual(base, draft)) return {ok:true, changed:0};
  const {add, remove} = availabilityDiff(base, draft);
  const operations = [...add.map(row => ({type:'add', row})),
    ...remove.map(row => ({type:'remove', row}))];
  if (operations.some(op => !validEntry(op.row))) {
    return {ok:false, partial:false, message:'Há períodos fora do próximo mês. Reabra a agenda e confira.'};
  }
  const applied = [];
  const run = async (type, row) => {
    const data = {pessoa_id:userId, dia:row.dia, culto:row.culto};
    const request = type === 'add'
      ? sb.from('disponibilidades').insert(data)
      : sb.from('disponibilidades').delete().match(data);
    const {error} = await request;
    if (error) throw error;
  };
  try {
    for (const op of operations) {
      await run(op.type, op.row);
      applied.push(op);
    }
    return {ok:true, changed:operations.length};
  } catch (error) {
    let rollbackFailed = false;
    for (const op of applied.reverse()) {
      try { await run(op.type === 'add' ? 'remove' : 'add', op.row); }
      catch { rollbackFailed = true; }
    }
    return {
      ok:false, partial:rollbackFailed,
      message:rollbackFailed
        ? 'Alguns períodos podem ter sido enviados. Confira a agenda e tente novamente.'
        : 'Não foi possível enviar. Seu rascunho continua aqui. Confira a conexão e tente novamente.',
    };
  }
}
