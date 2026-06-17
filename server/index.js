const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { ApolloServer } = require('@apollo/server');
// Cambiamos la importación a la forma estándar para evitar el error de ruta
const { expressMiddleware } = require('@as-integrations/express4');
const bodyParser = require('body-parser');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { typeDefs } = require('./graphql/schema');
const resolvers = require('./graphql/resolvers');
const { initSocket } = require('./websocket/connection');

const app = express();

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// Servir archivos estáticos del frontend (Vite)
// Nota: En producción, Render servirá lo que esté en la carpeta dist
app.use(express.static(path.join(__dirname, '../dist')));

const httpServer = http.createServer(app);
initSocket(httpServer);

const schema = makeExecutableSchema({ typeDefs, resolvers });
const server = new ApolloServer({ schema });

(async () => {
  await server.start();
  
  // Middleware de GraphQL
  app.use('/graphql', expressMiddleware(server, {
    context: async ({ req }) => ({ req })
  }));

  // Manejo de rutas del frontend (SPA - React)
  // Esto asegura que al refrescar la página no falle
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist', 'index.html'));
  });

  const PORT = process.env.PORT || 4000;
  httpServer.listen(PORT, () => {
    console.log(`🚀 Servidor listo en el puerto ${PORT}`);
  });
})();