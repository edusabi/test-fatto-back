const express = require("express");
const app = express();
const cors = require("cors");

app.use(express.json());
app.use(cors());

const pool = require("./infra/conexao");

app.get("/", async (req, res) => {
  res.send("Olá");
});

// Rota para obter todas as tarefas
app.get("/getDados", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM tarefas");

    const tarefas = result.rows.map((tarefa) => ({
      ...tarefa,
      data_limite: new Date(tarefa.data_limite).toLocaleDateString("pt-BR"),
    }));

    res.status(200).json(tarefas);
  } catch (err) {
    console.error("Erro ao buscar dados:", err);
    res.status(500).json({ error: "Erro ao buscar dados" });
  }
});

// Rota para adicionar as tarefas
app.post("/addTarefa", async (req, res) => {
  const { nomeTarefa, custo, dataLimite } = req.body;

  if (!nomeTarefa || !custo || !dataLimite) {
    return res.status(400).json({
      error: "Todos os campos são obrigatórios: nomeTarefa, custo, dataLimite",
    });
  }

  try {
    const nomeQuery = `SELECT id FROM tarefas WHERE nome = $1;`;
    const nomeResult = await pool.query(nomeQuery, [nomeTarefa]);
    if (nomeResult.rows.length > 0) {
      return res.status(400).json({ error: "Já existe uma tarefa com este nome." });
    }

    const ordemQuery = `SELECT COALESCE(MAX(ordem), 0) AS maior_ordem FROM tarefas;`;
    const ordemResult = await pool.query(ordemQuery);
    const maiorOrdem = ordemResult.rows[0].maior_ordem;
    const novaOrdem = maiorOrdem + 1;

    const dataFormatada = new Date(dataLimite).toISOString().split("T")[0];

    const query = `
        INSERT INTO tarefas (nome, custo, data_limite, ordem)
        VALUES ($1, $2, $3, $4) RETURNING *;
      `;
    const values = [nomeTarefa, custo, dataFormatada, novaOrdem];

    const result = await pool.query(query, values);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao incluir tarefa:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// Rota para deletar as tarefas
app.delete("/deletarTarefa/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const resultado = await pool.query("DELETE FROM tarefas WHERE id = $1", [id]);

    if (resultado.rowCount > 0) {
      res.status(200).json({ message: "Tarefa deletada com sucesso" });
    } else {
      res.status(404).json({ error: "Tarefa não encontrada" });
    }
  } catch (err) {
    console.error("Erro ao deletar tarefa:", err);
    res.status(500).json({ error: "Erro ao deletar tarefa" });
  }
});

app.put("/atualizarOrdem", async (req, res) => {
  const { novaOrdem } = req.body;

  if (!Array.isArray(novaOrdem) || novaOrdem.length === 0) {
    return res.status(400).json({
      error: "É necessário enviar um array com a nova ordem das tarefas.",
    });
  }

  try {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      for (let i = 0; i < novaOrdem.length; i++) {
        const { id } = novaOrdem[i];
        const tempOrdem = -(i + 1);
        await client.query("UPDATE tarefas SET ordem = $1 WHERE id = $2;", [tempOrdem, id]);
      }

      for (const tarefa of novaOrdem) {
        await client.query("UPDATE tarefas SET ordem = $1 WHERE id = $2;", [tarefa.ordem, tarefa.id]);
      }

      await client.query("COMMIT");
      res.status(200).json({ message: "Ordem atualizada com sucesso!" });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Erro ao atualizar a ordem:", error);
      res.status(500).json({ error: "Erro ao atualizar a ordem das tarefas" });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Erro ao conectar ao banco de dados:", error);
    res.status(500).json({ error: "Erro ao conectar ao banco de dados" });
  }
});

app.put("/editTarefa", async (req, res) => {
  const { id, nomeTarefa, custo, dataLimite } = req.body;

  if (!id) {
    return res.status(400).json({ error: "ID da tarefa é obrigatório." });
  }

  try {
    const query = `
      UPDATE tarefas
      SET nome = $1, custo = $2, data_limite = $3
      WHERE id = $4
      RETURNING *;
    `;

    const valores = [nomeTarefa, custo, dataLimite, id];
    const resultado = await pool.query(query, valores);

    if (resultado.rowCount === 0) {
      return res.status(404).json({ error: "Tarefa não encontrada." });
    }

    res.status(200).json({ message: "Tarefa atualizada com sucesso.", tarefa: resultado.rows[0] });
  } catch (error) {
    console.error("Erro ao atualizar tarefa:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// Exportar para a Vercel
module.exports = app;

