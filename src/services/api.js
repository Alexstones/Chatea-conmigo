const IS_DEV = import.meta.env.DEV;
export const GRAPHQL_URL = IS_DEV 
  ? 'http://localhost:4000/graphql' 
  : `${window.location.origin}/graphql`;

export async function fetchGraphQL(query, variables = {}) {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  return res.json();
}