/**
 * Environment configuration with runtime validation
 */

export type SolanaNetwork = 'devnet' | 'testnet' | 'mainnet-beta';

interface EnvConfig {
  solanaNetwork: SolanaNetwork;
  solanaRpcUrl: string;
  apiUrl: string;
}

function validateNetwork(network: string | undefined): SolanaNetwork {
  if (network !== 'devnet' && network !== 'testnet' && network !== 'mainnet-beta') {
    throw new Error(
      `Invalid NEXT_PUBLIC_SOLANA_NETWORK: "${network}". Must be "devnet", "testnet", or "mainnet-beta".`
    );
  }
  return network;
}

function validateUrl(url: string | undefined, name: string): string {
  if (!url) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid URL for ${name}: "${url}"`);
  }
  return url;
}

function createEnvConfig(): EnvConfig {
  const solanaNetwork = validateNetwork(process.env.NEXT_PUBLIC_SOLANA_NETWORK);
  const solanaRpcUrl = validateUrl(
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
    'NEXT_PUBLIC_SOLANA_RPC_URL'
  );
  const apiUrl = validateUrl(process.env.NEXT_PUBLIC_API_URL, 'NEXT_PUBLIC_API_URL');

  return {
    solanaNetwork,
    solanaRpcUrl,
    apiUrl,
  };
}

export const env = createEnvConfig();
