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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

let channel, connection;
async function connectRabbitMQ() {
  try {
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    await channel.assertQueue(QUEUE, {
      durable: true,
      arguments: {
        'x-message-ttl': 60000,
        'x-dead-letter-exchange': 'dead_letter_exchange',
        'x-dead-letter-routing-key': 'all.errors',
        'x-max-retries': 5
      }
    });

    await channel.assertExchange('dead_letter_exchange', 'direct', { durable: true });
    await channel.assertQueue('dead_letters', { durable: true });
    await channel.bindQueue('dead_letters', 'dead_letter_exchange', 'all.errors');

    console.log('Conectado ao RabbitMQ');
  } catch (error) {
    console.error('Erro ao conectar no RabbitMQ:', error);
  }
}
connectRabbitMQ();

app.post('/reserve', async (req, res) => {
  const { salaoNumber, client } = req.body;
  if (!salaoNumber || !client) {
    return res.status(400).json({ message: 'Campos salaoNumber, reservationTime e client são obrigatórios.' });
  }
  try {
    const query = 'SELECT * FROM salao_festas WHERE number = $1';
    const result = await pool.query(query, [salaoNumber]);
    if (result.rowCount === 0) {
      await pool.query(
        'INSERT INTO historico (salao_number, operation, details, created_at) VALUES ($1, $2, $3, $4)',
        [salaoNumber, 'erro', 'Salão não encontrado.', new Date()]
      );

      return res.status(404).json({ message: 'Salão não encontrado.' });
    }

    const message = {
      salaoNumber,
      client,
      created_at: new Date()
    };
    channel.sendToQueue(QUEUE, Buffer.from(JSON.stringify(message)), { persistent: true });
    return res.status(202).json({ message: 'Requisição de reserva recebida e está sendo processada.' });
  } catch (error) {
    console.error('Erro na requisição:', error);
    return res.status(500).json({ message: 'Erro interno.' });
  }
});

app.get('/consult', async (req, res) => {
  try {
    const query = 'SELECT * FROM salao_festas';
    const result = await pool.query(query);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Nenhum salão encontrado.' });
    }
    return res.status(200).send(result.rows);
  } catch (error) {
    console.error('Erro na consulta:', error);
    return res.status(500).json({ message: 'Erro interno.' });
  }
});

app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
