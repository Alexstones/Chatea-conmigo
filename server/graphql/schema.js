const typeDefs = `#graphql

type Message {
  id: ID!
  author: String!
  text: String!
  createdAt: String!
}

type Query {
  messages: [Message!]!
}

type Mutation {
  sendMessage(
    author: String!
    text: String!
  ): Message!
}
`;

module.exports = { typeDefs };