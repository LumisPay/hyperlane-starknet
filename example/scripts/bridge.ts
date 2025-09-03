/****************************************************************
 * bridge.ts  –  Hyperlane Warp-Route helper
 *
 *  Usage:
 *      ts-node bridge.ts chiado    # lock on Chiado, mint on Starknet
 *      ts-node bridge.ts starknet  # burn on Starknet, unlock on Chiado
 *
 ****************************************************************/

import 'dotenv/config';
import { ethers } from 'ethers';
import { Account, BigNumberish, cairo, CairoOption, CairoOptionVariant, Contract, json } from 'starknet';

import dotenv from 'dotenv';
import { buildAccount } from '../../scripts/utils'; // ← your helper

import fs from 'fs';

type Order = {
	p1: BigNumberish;
	p2: BigNumberish;
};

dotenv.config();

const TOKEN_PATH = '../cairo/target/dev/token';

function findContractFile(name: string, suffix: string): string {
	const tokenPath = `${TOKEN_PATH}_${name}${suffix}`;

	if (fs.existsSync(tokenPath)) {
		return tokenPath;
	}

	throw new Error(`Contract file not found for ${name} with suffix ${suffix} at ${tokenPath}`);
}

export function getCompiledContract(name: string): any {
	const contractPath = findContractFile(name, '.contract_class.json');
	return json.parse(fs.readFileSync(contractPath).toString('ascii'));
}

/****************************************************************
 * ENV
 ****************************************************************/

// ---------- Chiado ----------
const CHIADO_RPC = 'https://gnosis-chiado-rpc.publicnode.com';
const GNOSIS_CHIADO_PK = process.env.GNOSIS_CHIADO_PK as string; // EOA that holds the token
const CHIADO_DOMAIN_ID = '10200'; // Chiado domain-id
const CHIADO_RECIPIENT = '0x_your_gnosischiado_recipient_address'; // recipient on Gnosis Chiado

// the token address on Gnosis Chiado we want to bridge
const collateralAddress = '0x_gnosischiado_token_you_want_to_bridge_address';
// the HypERC20Collateral contract on Gnosis Chiado chain
const hypERC20CollateralAddress = '0x_deployed_hyper20_collateral_address'; // HypERC20Collateral on Chiado

// ---------- Starknet ----------
const STARKNET_HYPERC20_ADDRESS = '0x_synthetic_contract_address'; // synthetic HypERC20 on Starknet
const STARKNET_RECIPIENT = '0x_starknet_recipient'; // felt recipient on Starknet
const STARKNET_DOMAIN_ID = '23448591'; // Starknet domain-id (fixed in the protocol)

if (!hypERC20CollateralAddress || !STARKNET_HYPERC20_ADDRESS) {
	throw new Error('Missing HypERC20Collateral or STARKNET_HYPERC20_ADDRESS');
}

/****************************************************************
 * MAIN
 ****************************************************************/
async function bridge(origin: 'chiado' | 'starknetsepolia') {
	if (origin === 'chiado') {
		/*----------------------------------------------------------
		 * Chiado ➜ Starknet  (lock & mint)
		 *---------------------------------------------------------*/
		if (!GNOSIS_CHIADO_PK || !STARKNET_RECIPIENT) {
			throw new Error('Set GNOSIS_CHIADO_PK and STARKNET_RECIPIENT in .env');
		}
		const provider = new ethers.JsonRpcProvider(CHIADO_RPC);
		const wallet = new ethers.Wallet(GNOSIS_CHIADO_PK, provider);

		const collateralAbi = ['function approve(address spender, uint256 amount) public returns (bool)'];

		// Minimal ABI: approve + transferRemote
		const hypERC20Abi = [
			'function transferRemote(uint32 domain, bytes32 recipient, uint256 amount) public returns (bool)'
		];

		const hypERC20CollateralContract = new ethers.Contract(hypERC20CollateralAddress, hypERC20Abi, wallet);
		const collateralContract = new ethers.Contract(collateralAddress, collateralAbi, wallet);

		const amount = ethers.parseUnits('0.1', 18); // 0.1 token

		console.log('🔐  approving collateral contract…');
		const tx1 = await collateralContract.approve(hypERC20CollateralAddress, amount);
		await tx1.wait();
		console.log(`✔️  approve()  →  ${tx1.hash}`);

		console.log('🚚  sending transferRemote…');
		const tx2 = await hypERC20CollateralContract.transferRemote(
			Number(STARKNET_DOMAIN_ID),
			ethers.zeroPadValue(STARKNET_RECIPIENT, 32), // bytes32 recipient
			amount
		);
		await tx2.wait();
		console.log(`✅  transferRemote()  →  ${tx2.hash}`);
		console.log('⏳  Relayer will mint on Starknet once signatures arrive.');
	} else if (origin === 'starknetsepolia') {
		/*------------------------------------------------------------
		 * Starknet ➜ Chiado  (burn & unlock)
		 *-----------------------------------------------------------*/
		const account: Account = await buildAccount();

		const compiledContract = getCompiledContract('HypErc20');
		const tokenContract = new Contract(compiledContract.abi, STARKNET_HYPERC20_ADDRESS, account);

		const amount = 1;
		const formattedAmount = cairo.uint256(amount * 10 ** 18);
		const recipient = '0x' + CHIADO_RECIPIENT!.slice(2).padStart(64, '0');

		console.log('🔥  burning synthetic token on Starknet…');
		const txRes = await tokenContract.invoke('transfer_remote', [
			// gnosis chain domain id
			Number(CHIADO_DOMAIN_ID),
			recipient, // gnosis chiado recipient
			formattedAmount, // amount
			0, // value
			new CairoOption<Order>(CairoOptionVariant.None), // hook_metadata
			new CairoOption<Order>(CairoOptionVariant.None) // hook
		]);

		await account.waitForTransaction(txRes.transaction_hash);

		console.log(`✅  burn sent  →  ${txRes.transaction_hash}`);
		console.log('⏳  Relayer will unlock on Chiado once signatures arrive.');
	}
}

/****************************************************************
 * Run
 ****************************************************************/
const arg = process.argv[2] as 'chiado' | 'starknetsepolia';
if (!arg || !['chiado', 'starknetsepolia'].includes(arg)) {
	console.error('Usage: ts-node bridge.ts <chiado|starknetsepolia>');
	process.exit(1);
}

bridge(arg).catch((err) => {
	console.error(err);
	process.exit(1);
});
