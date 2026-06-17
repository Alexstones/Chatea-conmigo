const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const bodyParser = require('body-parser');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { typeDefs } = require('./graphql/schema');
const resolvers = require('./graphql/resolvers');
const { initSocket } = require('./websocket/connection');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Servir archivos estáticos del frontend (Vite)
app.use(express.static(path.join(__dirname, '../dist')));

const httpServer = http.createServer(app);
initSocket(httpServer);

const schema = makeExecutableSchema({ typeDefs, resolvers });
const server = new ApolloServer({ schema });

(async () => {
  await server.start();
  
  app.use('/graphql', expressMiddleware(server, {
    context: async ({ req }) => ({ req })
  }));

  // Ruta para que React maneje la navegación
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist', 'index.html'));
  });

  const PORT = process.env.PORT || 4000;
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server ready at port ${PORT}`);
  });
})();