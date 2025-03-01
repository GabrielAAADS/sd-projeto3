# 🎉 Sistema de Reservas para Salão de Festas com Histórico

Este projeto é uma **atividade avaliativa** que demonstra uma arquitetura distribuída para gerenciar reservas de salões de festas.  
O sistema utiliza **Node.js + Express** para a API, **RabbitMQ** para processamento assíncrono e **PostgreSQL** para armazenamento.  
Além disso, todas as operações são registradas em um **histórico**, permitindo auditoria e rastreamento de erros e reservas.

---

## 📚 Arquitetura do Sistema

### 🏗️ Componentes

- **📌 API (Express)**
  - **Função:** Receber requisições de reserva e consulta.
  - **Endpoints:**
    - **POST `/reserve`** → Publica uma mensagem na fila do RabbitMQ para processar uma reserva.
    - **GET `/consult`** → Retorna o status atual dos salões de festas.

- **⚙️ Worker**
  - **Função:** Consumir mensagens da fila `reservations`, processar a reserva e atualizar o banco de dados.
  - **Tarefas:**
    - Verificar se o salão está disponível.
    - Atualizar o status do salão (reservado ou disponível) na tabela `salao_festas`.
    - Registrar **todas** as operações (sucesso ou erro) na tabela `historico`.

- **📥 RabbitMQ (Message Broker)**
  - **Função:** Desacoplar a API do processamento da reserva.
  - **Funcionalidades:**
    - Gerenciar a fila `reservations` para envio e consumo de mensagens.
    - Implementar **Dead Letter Exchange** para mover mensagens não processadas para a fila `dead_letters`.

- **🗄️ PostgreSQL (Banco de Dados)**
  - **Função:** Armazenar os dados dos salões e manter o histórico das operações.
  - **Tabelas:**
    - `salao_festas` → Armazena o status atual de cada salão (número, status, cliente, data da última atualização).
    - `historico` → Registra cada operação realizada (tentativas de reserva, erros, sucessos, etc.).

### 🔄 Fluxo de Comunicação

1. **API → RabbitMQ:**  
   - A API recebe a requisição de reserva e publica uma mensagem na fila `reservations`.

2. **RabbitMQ → Worker:**  
   - O Worker consome a mensagem e processa a reserva.

3. **Worker → PostgreSQL:**  
   - O Worker consulta e atualiza a tabela `salao_festas` e registra a operação na tabela `historico`.

4. **Dead Letter Handling:**  
   - Se uma mensagem não for processada (erro ou timeout), ela será movida para a fila `dead_letters`.

---

## 🚀 Como Executar o Projeto

### 📌 Pré-Requisitos

- **🟢 Node.js e NPM:**  
  - [Instale o Node.js](https://nodejs.org/)
  
- **🟠 PostgreSQL:**  
  - **Configuração Padrão:**
    - **Host:** `localhost`
    - **Porta:** `5432`
    - **Usuário:** `postgres`
    - **Senha:** `suaSenha123`
    - **Banco de Dados:** `reservations_db`
  
- **🔵 RabbitMQ:**  
  - **Configuração Padrão:**
    - **URL:** `amqp://localhost`
    - **Porta:** `5672`
    - **Gerenciamento:** [http://localhost:15672](http://localhost:15672)  
      - **Usuário/Senha Padrão:** `guest` / `guest`

---

## 🛠️ Configuração do Projeto

### 1️⃣ Clonar o Repositório

```bash
git clone https://github.com/seu-usuario/seu-repositorio.git
cd seu-repositorio
