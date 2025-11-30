import { supabase } from './supabase';

export interface TokenConfig {
  name: string;
  symbol: string;
  totalSupply: string;
  decimals: number;
}

export async function createProjectToken(
  projectId: string,
  config: TokenConfig
): Promise<{ tokenAddress: string; transactionHash: string }> {
  const generateRandomAddress = () => {
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const tokenAddress = generateRandomAddress();

  await supabase.from('project_tokens').insert({
    project_id: projectId,
    token_address: tokenAddress,
    token_name: config.name,
    token_symbol: config.symbol,
    total_supply: parseFloat(config.totalSupply),
    decimals: config.decimals,
  });

  return {
    tokenAddress,
    transactionHash: `0x${Math.random().toString(16).substring(2)}`,
  };
}

export async function getProjectToken(projectId: string) {
  const { data, error } = await supabase
    .from('project_tokens')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  if (error) throw error;
  return data;
}
