import { Client, createClient } from "@urql/core";

import { BondSnapshotsLatestBlockQueryDocument, BondSnapshotsQueryDocument } from "./generated/graphql-operations";

export const getClient = (url: string): Client => {
  return createClient({
    url: url,
  });
};

export const getLatestBlock = async (client: Client): Promise<number> => {
  console.log("Fetching latest block");
  const query = await client.query(BondSnapshotsLatestBlockQueryDocument, {}).toPromise();

  if (!query.data || query.data.bondSnapshots.length === 0) {
    throw new Error("Unable to determine latest block");
  }

  const latestBlock = query.data.bondSnapshots[0].block;
  console.log(`Latest block is ${latestBlock}`);
  return parseInt(latestBlock);
};

// We define our own type, as we do not need all of the fields in BondSnapshot
export type Snapshot = {
  id: string;
  date: string;
  timestamp: number;
  contractAddress: string;
  contractId: number;
  price: number;
  debtDecayIntervalSeconds: number;
  previousControlVariable: number;
  controlVariable: number;
  tuneAdjustmentDelaySeconds: number;
};

export type SnapshotMap = Map<string, Snapshot>;

export const getSnapshots = async (client: Client, block: number): Promise<SnapshotMap> => {
  console.log("Fetching snapshots at latest block");
  const query = await client.query(BondSnapshotsQueryDocument, { block: block.toString() }).toPromise();

  if (!query.data) {
    throw new Error("Unable to obtain snapshots");
  }

  const results = query.data.bondSnapshots;
  console.log(`Received ${results.length} records`);

  // Extract the snapshots into the map
  const snapshotsMap = new Map<string, Snapshot>();
  results.forEach(value => {
    const snapshotMapId = `${value.contractAddress}/${value.contractId}`;

    // For each block, there should only be one permutation of contractAddress and contractId, so be defensive.
    if (snapshotsMap.has(snapshotMapId)) {
      throw new Error(`Did not expect to find existing value for snapshot map id ${snapshotMapId}`);
    }

    /**
     * Even though the values are typed, the GraphQL client doesn't convert the values into the right type.
     *
     * The GraphQL schema is configured to expect strings, which we then explicitly convert to numbers.
     *
     * Of the numbers in the results, only price is expected to be a float.
     */
    console.log(`Transforming received snapshot: ${JSON.stringify(value, null, 2)}`);
    const compatibleValue: Snapshot = {
      ...value,
      timestamp: parseInt(value.timestamp),
      contractAddress: value.contractAddress.toString(),
      contractId: parseInt(value.contractId),
      price: parseFloat(value.price),
      debtDecayIntervalSeconds: parseInt(value.debtDecayIntervalSeconds),
      previousControlVariable: parseInt(value.previousControlVariable),
      controlVariable: parseInt(value.controlVariable),
      tuneAdjustmentDelaySeconds: parseInt(value.tuneAdjustmentDelaySeconds),
    };

    snapshotsMap.set(snapshotMapId, compatibleValue);
  });

  return snapshotsMap;
};
