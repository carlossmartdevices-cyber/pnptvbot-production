module.exports = {
  // Puerto en el que escucha el servidor agente
  port: process.env.AGENT_PORT || 3000,

  // Configuración de la cola de mensajes (ej. RabbitMQ, Redis)
  queue: {
    host: process.env.QUEUE_HOST || 'localhost',
    port: process.env.QUEUE_PORT || 6379,
    password: process.env.QUEUE_PASSWORD || '',
  },

  // Configuración de logs
  logs: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'agent.log',
  },

  // Configuración de seguridad (ej. JWT, API keys)
  security: {
    apiKey: process.env.AGENT_API_KEY || 'default-api-key',
    jwtSecret: process.env.JWT_SECRET || 'default-secret',
  },
};
