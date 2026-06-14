// server/index.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const bodyParser = require('body-parser');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { typeDefs } = require('./graphql/schema');
const { resolvers } = require('./graphql/resolvers');
const { initSocket, setMessageBroadcaster, sendToUser } = require('./socket');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const httpServer = http.createServer(app);
initSocket(httpServer);

setMessageBroadcaster((message) => {
  if (!message?.to) return;

  sendToUser(message.to, {
    type: 'private_message',
    message
  });
});

const schema = makeExecutableSchema({ typeDefs, resolvers });
const server = new ApolloServer({ schema });

(async () => {
  await server.start();
  app.use('/graphql', expressMiddleware(server, {
    context: async ({ req }) => ({ req })
  }));
  const PORT = process.env.PORT || 4000;
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
  });
})();
