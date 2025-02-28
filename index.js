const express = require('express');
const bodyParser = require('body-parser');
const amqp = require('amqplib');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const QUEUE = 'reservations';

// Configuração do PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Conexão com RabbitMQ
let channel, connection;
async function connectRabbitMQ() {
  try {
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue(QUEUE, { durable: true });
    console.log('Conectado ao RabbitMQ');
  } catch (error) {
    console.error('Erro ao conectar no RabbitMQ:', error);
  }
}
connectRabbitMQ();

// Endpoint para reservar uma quadra
app.post('/reserve', async (req, res) => {
  const { quadraNumber, reservationTime, client } = req.body;
  if (!quadraNumber || !reservationTime || !client) {
    return res.status(400).json({ message: 'Campos quadraNumber, reservationTime e client são obrigatórios.' });
  }
  try {
    // Verifica se a quadra existe
    const query = 'SELECT * FROM quadras WHERE number = $1';
    const result = await pool.query(query, [quadraNumber]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Quadra não encontrada.' });
    }
    // Cria o payload da mensagem
    const message = {
      quadraNumber,
      reservationTime,
      client,
      created_at: new Date()
    };
    // Publica a mensagem na fila do RabbitMQ
    channel.sendToQueue(QUEUE, Buffer.from(JSON.stringify(message)), { persistent: true });
    return res.status(202).json({ message: 'Requisição de reserva recebida e está sendo processada.' });
  } catch (error) {
    console.error('Erro na requisição:', error);
    return res.status(500).json({ message: 'Erro interno.' });
  }
});

app.get('/consult', async (req, res) => {
  try {
    // Verifica se a quadra existe
    const query = 'SELECT * FROM quadras';
    const result = await pool.query(query);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Quadra não encontrada.' });
    }
    return res.status(200).send(result.rows);
  } catch (error) {
    console.error('Erro na requisição:', error);
    return res.status(500).json({ message: 'Erro interno.' });
  }
});

app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
