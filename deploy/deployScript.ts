import { readFileSync } from "fs";
import path from "path";
import {
  TransactionHash,
  TransactionStatus,
  GenLayerClient,
  DecodedDeployData,
  GenLayerChain,
} from "genlayer-js/types";
import { localnet } from "genlayer-js/chains";

export default async function main(client: GenLayerClient<any>) {
  const filePath = path.resolve(process.cwd(), "contracts/DevDAO.py");
  // Helper to add a timeout to async client calls
  function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Operation timed out after ${ms}ms`)),
        ms,
      );
      p.then((v) => {
        clearTimeout(timer);
        resolve(v);
      }).catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
    });
  }

  try {
    const contractCode = new Uint8Array(readFileSync(filePath));

    // Ensure the RPC is responsive for these operations; fail fast if not
    await withTimeout(client.initializeConsensusSmartContract(), 15000);

    const deployTransaction = await withTimeout(
      client.deployContract({
        code: contractCode,
        args: [],
      }),
      15000,
    );

    const receipt = await withTimeout(
      client.waitForTransactionReceipt({
        hash: deployTransaction as TransactionHash,
        status: TransactionStatus.ACCEPTED,
        retries: 20,
      }),
      120000,
    );

    if (
      receipt.status !== 5 &&
      receipt.status !== 6 &&
      receipt.statusName !== "ACCEPTED" &&
      receipt.statusName !== "FINALIZED"
    ) {
      throw new Error(`Deployment failed. Receipt: ${JSON.stringify(receipt)}`);
    }

    const deployedContractAddress =
      (client.chain as GenLayerChain).id === localnet.id
        ? receipt.data.contract_address
        : (receipt.txDataDecoded as DecodedDeployData)?.contractAddress;

    console.log(`Contract deployed at address: ${deployedContractAddress}`);
  } catch (error) {
    throw new Error(`Error during deployment:, ${error}`);
  }
}
