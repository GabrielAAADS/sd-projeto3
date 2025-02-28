const amqp = require('amqplib');
const { Pool } = require('pg');
require('dotenv').config();

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const QUEUE = 'reservations';

// Configuração do PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Função para processar a mensagem
async function processMessage(msg) {
  try {
    const content = JSON.parse(msg.content.toString());
    const { quadraNumber, reservationTime, client, created_at } = content;
    // Consulta a quadra no banco de dados
    const selectQuery = 'SELECT * FROM quadras WHERE number = $1';
    const result = await pool.query(selectQuery, [quadraNumber]);
    if (result.rowCount === 0) {
      console.error(`Quadra ${quadraNumber} não encontrada.`);
      return;
    }
    const quadra = result.rows[0];
    console.log("opa ", quadra);
    if (quadra.status === 'alugada') {
      console.error(`Quadra ${quadraNumber} já está reservada.`);
      return;
    }
    // Atualiza o status da quadra para 'alugada' e registra os dados da reserva
    const updateQuery = `
      UPDATE quadras
      SET status = $1, client = $2, reservation_time = $3, created_at = $4
      WHERE number = $5
    `;
    await pool.query(updateQuery, ['alugada', client, reservationTime, created_at, quadraNumber]);
    console.log(`Quadra ${quadraNumber} reservada para ${client}.`);
  } catch (error) {
    console.error('Erro ao processar mensagem:', error);
  }
}

// Inicializa o worker
async function startWorker() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue(QUEUE, { durable: true });
    console.log('Worker iniciado, aguardando mensagens...');
    channel.consume(QUEUE, async (msg) => {
      if (msg !== null) {
        await processMessage(msg);
        channel.ack(msg);
      }
    });
  } catch (error) {
    console.error('Erro no worker:', error);
  }
}
startWorker();