const { bot } = require('./paymentHandler');
const express = require('express');
const app = express();

// Middleware para webhooks de Daimo (simplificado)
app.post('/daimo-webhook', express.json(), (req, res) => {
  const event = req.body;
  if (event.status === 'payment_completed') {
    // Aquí actualizarías la base de datos y notificarías al usuario en Telegram
    console.log('Pago completado:', event);
  }
  res.status(200).end();
});

// Iniciar bot y servidor
bot.launch();
app.listen(3000, () => console.log('Bot y webhook escuchando en puerto 3000'));
