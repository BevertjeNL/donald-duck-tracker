// Vercel-functie: leest en schrijft de tabel `magazines` in Neon via de
// SQL-over-HTTP-endpoint van Neon. Geen dependencies nodig.
const INSERT_FIELDS = ['type', 'year', 'number', 'label', 'is_special', 'gelezen', 'gelezen_op'];
const UPDATE_FIELDS = ['gelezen', 'gelezen_op', 'number', 'label'];

async function sql(query, params = []) {
  const connectionString = process.env.DATABASE_URL;
  const { hostname } = new URL(connectionString);
  const res = await fetch(`https://${hostname}/sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Neon-Connection-String': connectionString },
    body: JSON.stringify({ query, params: params.map((p) => (p === null || p === undefined ? null : String(p))) }),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || 'Databasefout'), { code: data.code });
  return data.rows;
}

function pick(body, fields) {
  return fields.filter((f) => f in body);
}

module.exports = async function handler(req, res) {
  try {
    const body = req.body || {};
    const { id } = req.query;

    if (req.method === 'GET') {
      return res.status(200).json(await sql('select * from magazines order by year, number'));
    }

    if (req.method === 'POST') {
      const keys = pick(body, INSERT_FIELDS);
      const rows = await sql(
        `insert into magazines (${keys.join(', ')}) values (${keys.map((_, i) => `$${i + 1}`).join(', ')}) returning *`,
        keys.map((k) => body[k])
      );
      return res.status(201).json(rows[0]);
    }

    if (req.method === 'PATCH' && id) {
      const keys = pick(body, UPDATE_FIELDS);
      if (!keys.length) return res.status(400).json({ error: 'Niets om te wijzigen.' });
      const rows = await sql(
        `update magazines set ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} where id = $${keys.length + 1} returning *`,
        [...keys.map((k) => body[k]), id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Editie niet gevonden.' });
      return res.status(200).json(rows[0]);
    }

    if (req.method === 'DELETE' && id) {
      await sql('delete from magazines where id = $1', [id]);
      return res.status(204).end();
    }

    return res.status(405).json({ error: 'Methode niet toegestaan.' });
  } catch (err) {
    console.error(err);
    return res.status(err.code === '23505' ? 409 : 500).json({ error: err.message, code: err.code });
  }
};
