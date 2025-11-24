import { Connection, Client } from '@temporalio/client';

let client = null;

export async function getTemporalClient() {
  if (!client) {
    const connection = await Connection.connect({
      address: 'localhost:7233', // Default Temporal server address
    });
    client = new Client({ connection });
  }
  return client;
}

export async function closeTemporalClient() {
  if (client) {
    await client.connection.close();
    client = null;
  }
}

export { client };
