const express = require("express");
const app = express();
const cors = require("cors");

app.use(express.json());

app.use(
  cors({
    origin: "http://localhost:8080",
    credentials: true,
  })
);

const pool = require("./infra/conexao");

app.get("/", async (req, res) => {
  res.send("Olá")
});

// Rota para obter todas as tarefas
app.get("/getDados", async (req, res) => {
    try {
      // Consulta SQL para buscar todos os dados da tabela "tarefas"
      const result = await pool.query("SELECT * FROM tarefas");
  
      // Formatar a data para o formato DD/MM/YYYY
      const tarefas = result.rows.map((tarefa) => ({
        ...tarefa,
        data_limite: new Date(tarefa.data_limite).toLocaleDateString("pt-BR"), // Formatação DD/MM/YYYY
      }));
  
      // Enviar os dados como resposta no formato JSON
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
      // Verificar se o nome já existe
      const nomeQuery = `SELECT id FROM tarefas WHERE nome = $1;`;
      const nomeResult = await pool.query(nomeQuery, [nomeTarefa]);
      if (nomeResult.rows.length > 0) {
        return res.status(400).json({ error: "Já existe uma tarefa com este nome." });
      }
  
      // Consultar a maior ordem existente no banco
      const ordemQuery = `SELECT COALESCE(MAX(ordem), 0) AS maior_ordem FROM tarefas;`;
      const ordemResult = await pool.query(ordemQuery);
      const maiorOrdem = ordemResult.rows[0].maior_ordem;
      const novaOrdem = maiorOrdem + 1;
  
      // Formatar a data para salvar no banco como YYYY-MM-DD
      const dataFormatada = new Date(dataLimite).toISOString().split("T")[0];
  
      // Inserir a nova tarefa no banco
      const query = `
          INSERT INTO tarefas (nome, custo, data_limite, ordem)
          VALUES ($1, $2, $3, $4) RETURNING *;
        `;
      const values = [nomeTarefa, custo, dataFormatada, novaOrdem];
  
      const result = await pool.query(query, values);
  
      // Retornar a tarefa criada
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Erro ao incluir tarefa:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  });
  

/// Rota para deletar as tarefas
app.delete("/deletarTarefa/:id", async (req, res) => {
    const { id } = req.params; // Obtém o id diretamente dos parâmetros da URL
  
    try {
      // Consulta SQL para deletar uma tarefa pelo id
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
        await client.query("BEGIN"); // Iniciar transação
  
        // Atualizar cada tarefa para um valor temporário (negativo)
        for (let i = 0; i < novaOrdem.length; i++) {
          const { id } = novaOrdem[i];
          const tempOrdem = -(i + 1); // Ordem temporária negativa
          await client.query("UPDATE tarefas SET ordem = $1 WHERE id = $2;", [
            tempOrdem,
            id,
          ]);
        }
  
        // Atualizar cada tarefa com a nova ordem correta
        for (const tarefa of novaOrdem) {
          await client.query("UPDATE tarefas SET ordem = $1 WHERE id = $2;", [
            tarefa.ordem,
            tarefa.id,
          ]);
        }
  
        await client.query("COMMIT"); // Confirmar transação
        res.status(200).json({ message: "Ordem atualizada com sucesso!" });
      } catch (error) {
        await client.query("ROLLBACK"); // Reverter transação em caso de erro
        console.error("Erro ao atualizar a ordem:", error);
        res.status(500).json({ error: "Erro ao atualizar a ordem das tarefas" });
      } finally {
        client.release(); // Liberar cliente
      }
    } catch (error) {
      console.error("Erro ao conectar ao banco de dados:", error);
      res.status(500).json({ error: "Erro ao conectar ao banco de dados" });
    }
  });

  //////Edit
  app.put('/editTarefa', async (req, res) => {
    const { id, nomeTarefa, custo, dataLimite } = req.body;
  
    if (!id) {
      return res.status(400).json({ error: 'ID da tarefa é obrigatório.' });
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
        return res.status(404).json({ error: 'Tarefa não encontrada.' });
      }
  
      res.status(200).json({ message: 'Tarefa atualizada com sucesso.', tarefa: resultado.rows[0] });
    } catch (error) {
      console.error('Erro ao atualizar tarefa:', error);
      res.status(500).json({ error: 'Erro interno do servidor.' });
    }
  });
  

  

// Iniciar o servidor
app.listen(3000, () => {
  console.log("Back-End Rodando na porta 3000!");
});
