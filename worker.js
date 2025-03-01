const amqp = require('amqplib');
const { Pool } = require('pg');
require('dotenv').config();

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const QUEUE = 'reservations';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function processMessage(msg) {
  try {
    const content = JSON.parse(msg.content.toString());
    const { salaoNumber, client, created_at } = content;

    const selectQuery = 'SELECT * FROM salao_festas WHERE number = $1';
    const result = await pool.query(selectQuery, [salaoNumber]);
    if (result.rowCount === 0) {
      console.error(`Salão ${salaoNumber} não encontrado.`);
      
      await pool.query(
        'INSERT INTO historico (salao_number, operation, details, created_at) VALUES ($1, $2, $3, $4)',
        [salaoNumber, 'erro', errMsg, new Date()]
      );

      return;
    }

    const quadra = result.rows[0];
    if (quadra.status === 'reservado') {
      console.error(`Salão ${salaoNumber} já está reservado.`);

      await pool.query(
        'INSERT INTO historico (salao_number, operation, details, created_at) VALUES ($1, $2, $3, $4)',
        [salaoNumber, 'erro', errMsg, new Date()]
      );

      return;
    }

    const updateQuery = `
      UPDATE salao_festas
      SET status = $1, client = $2, created_at = $3
      WHERE number = $4
    `;
    
    await pool.query(updateQuery, ['reservado', client, created_at, salaoNumber]);
    console.log(`Quadra ${salaoNumber} reservada para ${client}.`);

    await pool.query(
      'INSERT INTO historico (salao_number, operation, details, created_at) VALUES ($1, $2, $3, $4)',
      [salaoNumber, 'reserva', `Salão reservado para ${client}`, new Date()]
    );

  } catch (error) {
    console.error('Erro ao processar mensagem:', error);
    
    await pool.query(
      'INSERT INTO historico (salao_number, operation, details, created_at) VALUES ($1, $2, $3, $4)',
      ['desconhecido', 'erro', error.message, new Date()]
    );
  }
}

async function startWorker() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();

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
    
    console.log('Worker iniciado, aguardando mensagens...');

    channel.consume(QUEUE, async (msg) => {
      try {
        if (msg !== null) {
          await processMessage(msg);
          channel.ack(msg);
        }
      } catch (error) {
        const retries = msg.properties.headers['x-retries'] || 0;
        if (retries >= 5) {
            channel.nack(msg, false, false);
        } else {
            channel.sendToQueue(QUEUE, msg.content, { headers: { 'x-retries': retries + 1 } });
            channel.ack(msg);
        }
        console.error('Erro no processamento, mensagem não confirmada:', error);
      }
    });
  } catch (error) {
    console.error('Erro no worker:', error);
  }
}
startWorker();