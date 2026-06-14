# Chat Público

Proyecto sencillo de chat en tiempo real con React, Node.js, GraphQL y WebSockets.

## Características
- Chat público para conversar de dos a dos.
- Entrada de usuario por nombre, sin registro por correo.
- Mensajes guardados en una base de datos pequeña local (`server/data/messages.json`).
- GraphQL para consultar el historial y enviar mensajes.
- WebSockets para recibir mensajes en tiempo real.
- Interfaz responsiva y cuidada sin librerías de UI externas.

## Ejecutar
1. Instalar dependencias:
```bash
npm install
```
2. En una terminal, iniciar el servidor:
```bash
npm run server
```
3. En otra terminal, iniciar el cliente:
```bash
npm run dev
```
4. Abrir `http://localhost:5173` en el navegador.

## Notas
- El servidor GraphQL está en `http://localhost:4000/graphql`.
- El canal WebSocket se conecta en `ws://localhost:4000/ws`.
